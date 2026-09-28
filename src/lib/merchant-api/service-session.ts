/**
 * 決済セッションの作成・決済照会・取引一覧（接続仕様書 第6章・第8章・第9章）
 */
import type { MerchantApiDeps } from "./deps";
import { MerchantApiError } from "./errors";
import { newPaymentId, newSessionId } from "./ids";
import {
  parseCreateSessionInput,
  validateSessionBusinessRules,
  type CreateSessionInput,
} from "./schema";
import { toPaymentResource, toSessionResource, type PaymentResource, type SessionResource } from "./serialize";
import { expireIfDue } from "./service-state";
import { UsenProfileError } from "./usen-profile";
import type { CredentialRow, MerchantPaymentRow, MerchantPaymentStatus } from "./types";

/** セッション作成の結果（201=新規 / 200=同じ注文IDの既存） */
export interface CreateSessionResult {
  httpStatus: 200 | 201;
  body: SessionResource;
}

/**
 * 同じ注文IDの既存決済が今回のリクエストと同じ内容か（第6章: amount と event を比較）。
 */
export function isSameOrder(row: MerchantPaymentRow, input: CreateSessionInput): boolean {
  return (
    Number(row.amount) === input.amount &&
    row.event_id === input.event.event_id &&
    row.event_name === input.event.event_name &&
    row.event_date === input.event.event_date
  );
}

/**
 * 既存の決済を冪等応答に変換する。内容違いは 409、期限切れは 410。
 */
async function respondExisting(
  deps: MerchantApiDeps,
  existing: MerchantPaymentRow,
  input: CreateSessionInput
): Promise<CreateSessionResult> {
  if (!isSameOrder(existing, input)) {
    throw new MerchantApiError("order_id_conflict", "同じ注文IDで異なる内容が登録済みです", {
      payment_id: existing.payment_id,
    });
  }
  const current = await expireIfDue(deps, existing);
  if (current.status === "expired") {
    throw new MerchantApiError("session_expired", "セッションの有効期限が切れています。新しい注文IDで作り直してください", {
      payment_id: current.payment_id,
    });
  }
  return { httpStatus: 200, body: toSessionResource(current, deps.appUrl) };
}

/**
 * 決済セッションを作成する。同じ注文IDの再送は新たな決済を作らず既存を返す。
 *
 * @param raw - JSON パース済みのリクエストボディ
 * @param ipAddress - 監査ログ用
 */
export async function createCheckoutSession(
  deps: MerchantApiDeps,
  credential: CredentialRow,
  raw: unknown,
  ipAddress: string | null
): Promise<CreateSessionResult> {
  if (credential.suspended_at) {
    throw new MerchantApiError("merchant_suspended", "加盟店の取引が停止されています。当社へご連絡ください");
  }
  const input = parseCreateSessionInput(raw);
  const now = deps.now();
  const { expiresIn } = validateSessionBusinessRules(
    input,
    {
      environment: credential.environment,
      allowedDomains: credential.allowed_domains,
      maxEventMonths: credential.max_event_months,
      amountLimitPerPayment: credential.amount_limit_per_payment === null ? null : Number(credential.amount_limit_per_payment),
      maxExpiresIn: credential.max_expires_in,
    },
    now
  );

  const existing = await deps.store.findPaymentByOrder(credential.merchant_id, credential.environment, input.order_id);
  if (existing) return respondExisting(deps, existing, input);

  const merchant = await deps.store.getMerchant(credential.merchant_id);
  let mallCd: string;
  try {
    mallCd = deps.resolveProfile(credential.environment, merchant?.mall_code ?? null).mallCd;
  } catch (e) {
    if (e instanceof UsenProfileError) {
      await deps.store.audit({ action: "merchant_config_error", merchantPaymentId: null, response: { error: e.message } });
      throw new MerchantApiError("service_unavailable", "決済サービスを一時的に利用できません");
    }
    throw e;
  }

  const jutyuCd = await deps.store.nextJutyuCd(mallCd);
  const inserted = await deps.store.insertPayment({
    merchant_id: credential.merchant_id,
    credential_id: credential.id,
    environment: credential.environment,
    order_id: input.order_id,
    payment_id: newPaymentId(),
    session_id: newSessionId(),
    amount: input.amount,
    event_id: input.event.event_id,
    event_name: input.event.event_name,
    event_date: input.event.event_date,
    event_settled_at: null,
    event_cancelled_at: null,
    items: input.items,
    customer_email: input.customer.email,
    return_url: input.return_url,
    cancel_url: input.cancel_url ?? null,
    usen_jutyu_cd: jutyuCd,
    expires_at: new Date(now.getTime() + expiresIn * 1000).toISOString(),
  });

  if (inserted === "conflict") {
    // 同じ注文IDの同時リクエストが先に作成した
    const winner = await deps.store.findPaymentByOrder(credential.merchant_id, credential.environment, input.order_id);
    if (!winner) throw new Error("[merchant-api] 一意制約違反後に既存行が見つかりません");
    return respondExisting(deps, winner, input);
  }

  await deps.store.audit({
    action: "merchant_session_create",
    merchantPaymentId: inserted.id,
    request: {
      order_id: input.order_id,
      amount: input.amount,
      event: input.event,
      expires_in: expiresIn,
      environment: credential.environment,
    },
    response: { payment_id: inserted.payment_id, jutyu_cd: jutyuCd },
    ipAddress,
  });
  return { httpStatus: 201, body: toSessionResource(inserted, deps.appUrl) };
}

/**
 * 決済が当該資格情報（加盟店・環境）のものか。他加盟店の決済は存在しないものとして扱う。
 */
function belongsTo(row: MerchantPaymentRow | null, credential: CredentialRow): row is MerchantPaymentRow {
  return !!row && row.merchant_id === credential.merchant_id && row.environment === credential.environment;
}

/**
 * 決済照会（payment_id）。期限切れの確定もここで行う。
 */
export async function getPaymentById(
  deps: MerchantApiDeps,
  credential: CredentialRow,
  paymentId: string
): Promise<PaymentResource> {
  const row = await deps.store.findPaymentByPaymentId(paymentId);
  if (!belongsTo(row, credential)) throw new MerchantApiError("payment_not_found", "該当する決済がありません");
  return toPaymentResource(await expireIfDue(deps, row));
}

/**
 * 決済照会（order_id）。
 */
export async function getPaymentByOrderId(
  deps: MerchantApiDeps,
  credential: CredentialRow,
  orderId: string
): Promise<PaymentResource> {
  const row = await deps.store.findPaymentByOrder(credential.merchant_id, credential.environment, orderId);
  if (!belongsTo(row, credential)) throw new MerchantApiError("payment_not_found", "該当する決済がありません");
  return toPaymentResource(await expireIfDue(deps, row));
}

const STATUSES: MerchantPaymentStatus[] = ["created", "pending", "succeeded", "failed", "cancelled", "expired", "refunded"];
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

/** 取引一覧のクエリ（URLSearchParams から読む） */
export interface ListQuery {
  from: string | null;
  to: string | null;
  status: string | null;
  event_id: string | null;
  limit: string | null;
  cursor: string | null;
}

/** 取引一覧のレスポンス */
export interface PaymentListResult {
  data: PaymentResource[];
  next_cursor: string | null;
  has_more: boolean;
}

/** カーソルを作る（base64url の JSON） */
export function encodeCursor(row: MerchantPaymentRow): string {
  return Buffer.from(JSON.stringify({ c: row.created_at, i: row.id }), "utf8").toString("base64url");
}

/** カーソルを読む。値はフィルタに埋め込むため形式を厳格に確認する */
export function decodeCursor(value: string): { createdAt: string; id: string } {
  try {
    const obj: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (obj && typeof obj === "object") {
      const { c, i } = obj as { c?: unknown; i?: unknown };
      if (
        typeof c === "string" &&
        typeof i === "string" &&
        /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(c) &&
        /^[0-9a-f-]{36}$/.test(i)
      ) {
        return { createdAt: c, id: i };
      }
    }
  } catch {
    // 下で invalid_request にする
  }
  throw new MerchantApiError("invalid_request", "cursor が不正です");
}

/**
 * 取引一覧（日次照合用）。
 */
export async function listPayments(
  deps: MerchantApiDeps,
  credential: CredentialRow,
  query: ListQuery
): Promise<PaymentListResult> {
  if (!query.from || !query.to) {
    throw new MerchantApiError("invalid_request", "from と to は必須です（order_id で引く場合は order_id を指定してください）");
  }
  const from = new Date(query.from);
  const to = new Date(query.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    throw new MerchantApiError("invalid_request", "from / to は ISO 8601 形式で、from < to としてください");
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new MerchantApiError("invalid_request", "from から to までの範囲は最大31日です");
  }
  const limit = query.limit === null ? 100 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new MerchantApiError("invalid_request", "limit は 1〜200 の整数です");
  }
  let statuses: MerchantPaymentStatus[] | undefined;
  if (query.status) {
    const parts = query.status.split(",").map((s) => s.trim());
    if (!parts.every((p): p is MerchantPaymentStatus => (STATUSES as string[]).includes(p))) {
      throw new MerchantApiError("invalid_request", "status の値が不正です");
    }
    statuses = parts as MerchantPaymentStatus[];
  }

  const rows = await deps.store.listPayments({
    merchantId: credential.merchant_id,
    environment: credential.environment,
    from: from.toISOString(),
    to: to.toISOString(),
    statuses,
    eventId: query.event_id ?? undefined,
    limit: limit + 1,
    cursor: query.cursor ? decodeCursor(query.cursor) : undefined,
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    data: page.map(toPaymentResource),
    next_cursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    has_more: hasMore,
  };
}
