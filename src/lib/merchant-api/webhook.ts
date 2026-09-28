/**
 * 決済結果通知の送信（接続仕様書 v1.0 第10章）
 *
 * - 本文: {type, payment_id, order_id, occurred_at}（金額は含めない）
 * - 署名: X-UD-Signature（第3章と同じ方式）
 * - 2xx を成功とし、10秒で打ち切る
 * - 再送は指数バックオフで24時間以内に最大5回（初回送信＋再送5回＝計6回）
 */
import type { MerchantApiDeps } from "./deps";
import { buildSignatureHeader } from "./signature";
import { toJstIso } from "./time";
import type { WebhookDeliveryRow } from "./types";

/** 通知の応答待ち上限 */
export const WEBHOOK_TIMEOUT_MS = 10_000;

/** 再送間隔（秒）。n 回目の失敗の後に待つ時間。合計 約8.6時間で24時間以内に収まる */
export const RETRY_DELAYS_SEC = [60, 300, 1800, 7200, 21600];

/**
 * 次の再送時刻。再送回数を使い切ったら null（打ち切り）。
 *
 * @param attempt - 送信済みの回数（今回の送信を含む）
 */
export function nextRetryAt(attempt: number, now: Date): Date | null {
  const delay = RETRY_DELAYS_SEC[attempt - 1];
  return delay === undefined ? null : new Date(now.getTime() + delay * 1000);
}

/** 通知本文 */
export interface WebhookPayload {
  type: string;
  payment_id: string;
  order_id: string;
  occurred_at: string;
}

/**
 * 1件送信して結果を記録する。
 *
 * @returns 配送できたか
 */
export async function deliverWebhook(
  deps: MerchantApiDeps,
  delivery: WebhookDeliveryRow,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const payment = await deps.store.findPaymentById(delivery.merchant_payment_id);
  const credential = payment ? await deps.store.getCredential(payment.credential_id) : null;
  const now = deps.now();
  const attempt = delivery.attempt + 1;
  if (!payment || !credential) {
    await deps.store.updateWebhook(delivery.id, {
      attempt,
      error_message: "決済または資格情報が見つかりません",
      next_retry_at: null,
    });
    return false;
  }

  const payload: WebhookPayload = {
    type: delivery.event_type,
    payment_id: payment.payment_id,
    order_id: payment.order_id,
    occurred_at: toJstIso(new Date(delivery.occurred_at)),
  };
  const body = JSON.stringify(payload);
  const [secret] = deps.secretsOf(credential);
  const timestamp = Math.floor(now.getTime() / 1000);

  let statusCode: number | null = null;
  let errorMessage: string | null = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetchImpl(delivery.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-UD-Signature": buildSignatureHeader(secret, timestamp, body),
        "User-Agent": "UD-Payment-Webhook/1.0",
      },
      body,
      signal: controller.signal,
      redirect: "manual",
    });
    statusCode = res.status;
    if (res.status < 200 || res.status >= 300) errorMessage = `HTTP ${res.status}`;
  } catch (e) {
    errorMessage = controller.signal.aborted ? "timeout" : e instanceof Error ? e.message : String(e);
  } finally {
    clearTimeout(timer);
  }

  const delivered = errorMessage === null;
  const retryAt = delivered ? null : nextRetryAt(attempt, now);
  await deps.store.updateWebhook(delivery.id, {
    attempt,
    status_code: statusCode,
    error_message: errorMessage,
    delivered_at: delivered ? now.toISOString() : null,
    next_retry_at: retryAt ? retryAt.toISOString() : null,
  });
  await deps.store.audit({
    action: "merchant_webhook_send",
    merchantPaymentId: payment.id,
    request: { type: delivery.event_type, url: delivery.url, attempt },
    response: { status_code: statusCode, error: errorMessage },
  });
  return delivered;
}

/**
 * 送信期限が来た通知をまとめて送る（Cron から呼ぶ）。
 *
 * @returns 送信を試みた件数と成功件数
 */
export async function deliverDueWebhooks(
  deps: MerchantApiDeps,
  limit = 20,
  fetchImpl: typeof fetch = fetch
): Promise<{ attempted: number; delivered: number }> {
  const due = await deps.store.listDueWebhooks(deps.now().toISOString(), limit);
  const results = await Promise.allSettled(due.map((d) => deliverWebhook(deps, d, fetchImpl)));
  const delivered = results.filter((r) => r.status === "fulfilled" && r.value).length;
  return { attempted: due.length, delivered };
}
