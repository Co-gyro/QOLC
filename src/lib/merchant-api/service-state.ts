/**
 * 加盟店API の状態遷移と USEN 照会による確定（接続仕様書 第4章・第8章・第10章）
 *
 * - 状態は前進のみ（created → pending → 終了状態、succeeded → refunded）
 * - 更新は「期待する現在状態」を条件に付けた条件付き UPDATE で行い、
 *   戻り・通知・期限切れ処理が同時に走っても1回しか成立しないようにする
 * - succeeded / failed / expired / refunded への遷移で決済結果通知を積む
 */
import type { MerchantApiDeps } from "./deps";
import { classifyTrade } from "./usen-gateway";
import { failureCodeFromUsen, failureMessage, type FailureCode } from "./serialize";
import { parseUsenDateTime } from "./time";
import type {
  MerchantPaymentRow,
  MerchantPaymentStatus,
  UpdateGuard,
  WebhookEventType,
} from "./types";

/** 期限切れと判定するまでの猶予（USEN 側の決済有効期限は分単位のため） */
export const EXPIRY_GRACE_MS = 60_000;

/** 遷移先ごとに許される現在状態 */
const ALLOWED_FROM: Record<MerchantPaymentStatus, MerchantPaymentStatus[]> = {
  created: [],
  pending: ["created"],
  succeeded: ["created", "pending"],
  failed: ["created", "pending"],
  cancelled: ["created", "pending"],
  expired: ["created", "pending"],
  refunded: ["succeeded"],
};

/** 通知を送る遷移（cancelled は仕様上通知しない） */
const WEBHOOK_EVENT: Partial<Record<MerchantPaymentStatus, WebhookEventType>> = {
  succeeded: "payment.succeeded",
  failed: "payment.failed",
  expired: "payment.expired",
  refunded: "payment.refunded",
};

/** 終了状態（closed_at を立てる） */
const CLOSING: MerchantPaymentStatus[] = ["failed", "cancelled", "expired"];

/**
 * 状態を遷移させる。前提を満たさなければ null（他の経路が先に確定させた）。
 *
 * @param extra - 追加で更新する列
 * @param guard - 追加の前提条件（受注コード一致・/i/pay 未要求など）
 */
export async function transition(
  deps: MerchantApiDeps,
  row: MerchantPaymentRow,
  to: MerchantPaymentStatus,
  extra: Partial<MerchantPaymentRow> = {},
  guard: UpdateGuard = {}
): Promise<MerchantPaymentRow | null> {
  const nowIso = deps.now().toISOString();
  const patch: Partial<MerchantPaymentRow> = {
    ...extra,
    status: to,
    ...(CLOSING.includes(to) ? { closed_at: nowIso } : {}),
  };
  const updated = await deps.store.updatePayment(row.id, patch, {
    ...guard,
    statusIn: ALLOWED_FROM[to],
  });
  if (!updated) return null;

  await deps.store.audit({
    action: `merchant_status_${to}`,
    merchantPaymentId: row.id,
    request: { from: row.status, to, order_id: row.order_id, payment_id: row.payment_id },
  });

  const eventType = WEBHOOK_EVENT[to];
  if (eventType) {
    const credential = await deps.store.getCredential(row.credential_id);
    if (credential?.webhook_url) {
      await deps.store.enqueueWebhook({
        merchantPaymentId: row.id,
        eventType,
        occurredAt: nowIso,
        url: credential.webhook_url,
      });
    }
  }
  return updated;
}

/** 失敗として確定させる */
export async function markFailed(
  deps: MerchantApiDeps,
  row: MerchantPaymentRow,
  code: FailureCode,
  guard: UpdateGuard = {}
): Promise<MerchantPaymentRow | null> {
  return transition(deps, row, "failed", { failure_code: code, failure_message: failureMessage(code) }, guard);
}

/** reconcile の補助情報（/i/pay の結果など） */
export interface ReconcileHint {
  /** /i/pay が返したカードブランド */
  brand?: string | null;
  /** /i/pay が返した処理結果詳細コード（ng のときの失敗理由に使う） */
  payCode?: string | null;
}

/**
 * USEN の取引照会で状態を確定させる。発券判断の根拠になるため、
 * 戻りやブラウザからの申告ではなく必ずここを通して succeeded にする。
 *
 * @returns 最新の行（遷移しなかった場合も照会結果を反映した行）
 */
export async function reconcile(
  deps: MerchantApiDeps,
  row: MerchantPaymentRow,
  hint: ReconcileHint = {}
): Promise<MerchantPaymentRow> {
  if (!row.usen_jutyu_cd) return row;
  const merchant = await deps.store.getMerchant(row.merchant_id);
  const profile = deps.resolveProfile(row.environment, merchant?.mall_code ?? null);
  const trade = await deps.usen.searchTrade(profile, row.usen_jutyu_cd);
  const outcome = classifyTrade(trade);
  await deps.store.audit({
    action: "merchant_search_trade",
    merchantPaymentId: row.id,
    request: { jutyu_cd: row.usen_jutyu_cd },
    response: { ...trade, card_num: undefined, outcome: outcome.kind },
  });

  const now = deps.now();
  const synced: Partial<MerchantPaymentRow> = {
    // ng の場合 status は空文字で返るため、result/code を記録する
    usen_status: trade.status || `${trade.result ?? ""}/${trade.code ?? ""}`,
    usen_synced_at: now.toISOString(),
  };

  switch (outcome.kind) {
    case "captured": {
      if (outcome.amount !== null && outcome.amount !== Number(row.amount)) {
        // 金額不一致は発券させない。運用で確認する（監査ログに残す）
        await deps.store.audit({
          action: "merchant_amount_mismatch",
          merchantPaymentId: row.id,
          request: { expected: row.amount, usen_amount: outcome.amount },
        });
        return (await deps.store.updatePayment(row.id, synced)) ?? row;
      }
      if (row.status === "succeeded") return (await deps.store.updatePayment(row.id, synced)) ?? row;
      const capturedAt = parseUsenDateTime(outcome.processedAt) ?? now;
      const done = await transition(deps, row, "succeeded", {
        ...synced,
        captured_at: capturedAt.toISOString(),
        card_last4: outcome.last4 ?? row.card_last4,
        card_brand: hint.brand ?? row.card_brand,
      });
      return done ?? (await refetch(deps, row));
    }
    case "refunded": {
      if (row.status !== "succeeded") return (await deps.store.updatePayment(row.id, synced)) ?? row;
      const done = await transition(deps, row, "refunded", { ...synced, refunded_at: now.toISOString() });
      return done ?? (await refetch(deps, row));
    }
    case "declined": {
      // 理由は /i/pay の処理結果詳細コード（09=3DS認証NG 等）を優先する。
      // それが無い場合（期限切れ処理からの照会等）は「カード会社による非承認」とする
      const fromPay = hint.payCode ? failureCodeFromUsen(hint.payCode) : "processing_error";
      const code: FailureCode = fromPay === "processing_error" ? "card_declined" : fromPay;
      const done = await transition(deps, row, "failed", {
        ...synced,
        failure_code: code,
        failure_message: failureMessage(code),
      });
      return done ?? (await refetch(deps, row));
    }
    default:
      return (await deps.store.updatePayment(row.id, synced)) ?? row;
  }
}

/** 行を取り直す（他経路が先に更新した場合） */
async function refetch(deps: MerchantApiDeps, row: MerchantPaymentRow): Promise<MerchantPaymentRow> {
  return (await deps.store.findPaymentByPaymentId(row.payment_id)) ?? row;
}

/** 未完了のまま期限（＋猶予）を過ぎているか */
export function isPastExpiry(row: MerchantPaymentRow, now: Date): boolean {
  return (
    (row.status === "created" || row.status === "pending") &&
    new Date(row.expires_at).getTime() + EXPIRY_GRACE_MS < now.getTime()
  );
}

/**
 * 期限を過ぎた未完了の決済を確定させる。USEN へ処理が進んでいたものは
 * 先に照会し、売上済みなら succeeded として扱う（決済済みを期限切れにしない）。
 */
export async function expireIfDue(deps: MerchantApiDeps, row: MerchantPaymentRow): Promise<MerchantPaymentRow> {
  if (!isPastExpiry(row, deps.now())) return row;
  let current = row;
  if (row.usen_attempted_at || row.usen_pay_requested_at) {
    current = await reconcile(deps, row);
    if (current.status !== "created" && current.status !== "pending") return current;
  }
  const done = await transition(deps, current, "expired");
  return done ?? (await refetch(deps, current));
}

/**
 * 期限切れの未完了決済をまとめて処理する（Cron から呼ぶ）。
 *
 * @returns 処理件数
 */
export async function expireDuePayments(deps: MerchantApiDeps, limit = 100): Promise<number> {
  const before = new Date(deps.now().getTime() - EXPIRY_GRACE_MS).toISOString();
  const rows = await deps.store.listExpiredOpenPayments(before, limit);
  let count = 0;
  for (const row of rows) {
    try {
      await expireIfDue(deps, row);
      count++;
    } catch (e) {
      // 1件の失敗で他を止めない（USEN 障害時は次回の Cron で再試行される）
      await deps.store.audit({
        action: "merchant_expire_error",
        merchantPaymentId: row.id,
        response: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  }
  return count;
}
