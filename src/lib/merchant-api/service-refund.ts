/**
 * 加盟店API の返金（接続仕様書 v1.0 第11章：返金は当社が実施）
 *
 * USEN の即時売上返品（/auth/return）で全額を返金し、成功したら refunded へ遷移させる
 * （payment.refunded 通知が積まれる）。部分返金は扱わない。
 * 返金できるのは succeeded の決済のみ。返金の期限は決済日から1年以内（USEN 回答 2026-09-02）。
 */
import type { MerchantApiDeps } from "./deps";
import { reconcile, transition } from "./service-state";
import { toPaymentResource, type PaymentResource } from "./serialize";
import { usenDate } from "./time";

/** 返金できない・失敗した理由（運用担当者向け） */
export class RefundError extends Error {
  /** @param message - 運用担当者向けの説明 */
  constructor(message: string) {
    super(message);
    this.name = "RefundError";
  }
}

/** 返金の結果 */
export interface RefundResult {
  payment: PaymentResource;
  usen: { result?: string; code?: string; processDay?: string };
}

/** 返金期限（決済日から1年） */
const REFUND_LIMIT_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * 決済を全額返金する。
 *
 * @param paymentId - 加盟店へ返している payment_id
 * @param operator - 監査ログに残す実施者（氏名やメールアドレス）
 * @throws {RefundError} 対象外の状態・USEN が返金を受け付けなかった場合
 */
export async function refundMerchantPayment(
  deps: MerchantApiDeps,
  paymentId: string,
  operator: string
): Promise<RefundResult> {
  const row = await deps.store.findPaymentByPaymentId(paymentId);
  if (!row) throw new RefundError(`決済が見つかりません: ${paymentId}`);
  if (row.status === "refunded") throw new RefundError("すでに返金済みです");
  if (row.status !== "succeeded") throw new RefundError(`返金できるのは succeeded の決済のみです（現在: ${row.status}）`);
  if (!row.usen_jutyu_cd || !row.captured_at) throw new RefundError("受注コードまたは売上計上日時が記録されていません");
  const now = deps.now();
  if (now.getTime() - new Date(row.captured_at).getTime() > REFUND_LIMIT_MS) {
    throw new RefundError("決済日から1年を過ぎているため、カードへの返金はできません");
  }

  const merchant = await deps.store.getMerchant(row.merchant_id);
  const profile = deps.resolveProfile(row.environment, merchant?.mall_code ?? null);
  const request = {
    jutyu_cd: row.usen_jutyu_cd,
    amount: Number(row.amount),
    // 売上計上日は JST の日付（USEN の process_date から記録した captured_at）
    sales_day: usenDate(new Date(row.captured_at)),
    operator,
  };
  let res;
  try {
    res = await deps.usen.refund(profile, {
      jutyuCd: request.jutyu_cd,
      amount: request.amount,
      salesDay: request.sales_day,
    });
  } catch (e) {
    await deps.store.audit({
      action: "merchant_refund",
      merchantPaymentId: row.id,
      request,
      response: { error: e instanceof Error ? e.message : String(e) },
    });
    throw new RefundError(`USEN との通信に失敗しました。取引照会で状態を確認してから再実行してください: ${e instanceof Error ? e.message : String(e)}`);
  }
  await deps.store.audit({ action: "merchant_refund", merchantPaymentId: row.id, request, response: res });

  if (res.result !== "ok") {
    // 41（対象無し）は返金済みの可能性もあるため、照会で状態を反映してから止める
    const current = await reconcile(deps, row).catch(() => row);
    if (current.status === "refunded") {
      return { payment: toPaymentResource(current), usen: { result: res.result, code: res.code } };
    }
    throw new RefundError(`USEN が返金を受け付けませんでした（result=${res.result ?? ""} code=${res.code ?? ""}）`);
  }

  const done = await transition(deps, row, "refunded", { refunded_at: now.toISOString() });
  const latest = done ?? (await deps.store.findPaymentByPaymentId(paymentId)) ?? row;
  return {
    payment: toPaymentResource(latest),
    usen: { result: res.result, code: res.code, processDay: res.process_day },
  };
}
