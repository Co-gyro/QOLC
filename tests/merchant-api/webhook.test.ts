import { describe, expect, it } from "vitest";
import { deliverDueWebhooks, deliverWebhook, nextRetryAt, RETRY_DELAYS_SEC } from "@/lib/merchant-api/webhook";
import { verifyRequestSignature } from "@/lib/merchant-api/signature";
import { makeDeps, makeRow, SECRET } from "./helpers";

/** 通知が1本積まれた状態 */
async function queued() {
  const ctx = makeDeps();
  const row = makeRow({ status: "succeeded" });
  ctx.store.payments.push(row);
  await ctx.store.enqueueWebhook({
    merchantPaymentId: row.id,
    eventType: "payment.succeeded",
    occurredAt: "2026-09-28T03:05:00.000Z",
    url: "https://ainylive.com/api/ud/webhook",
  });
  return { ...ctx, row };
}

/** 応答を固定した fetch（送信内容を記録） */
function fakeFetch(status: number | Error) {
  const sent: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    if (status instanceof Error) throw status;
    // 204 等の本文なしステータスに本文を付けると Response が例外を投げるため null
    return new Response(null, { status });
  }) as unknown as typeof fetch;
  return { sent, impl };
}

describe("再送スケジュール（24時間以内に最大5回）", () => {
  it("初回＋再送5回で打ち切り、合計は24時間以内", () => {
    const now = new Date("2026-09-28T00:00:00Z");
    expect(nextRetryAt(1, now)?.toISOString()).toBe("2026-09-28T00:01:00.000Z");
    expect(nextRetryAt(5, now)).not.toBeNull();
    expect(nextRetryAt(6, now)).toBeNull();
    expect(RETRY_DELAYS_SEC.reduce((a, b) => a + b, 0)).toBeLessThan(24 * 3600);
  });
});

describe("deliverWebhook（第10章）", () => {
  it("署名付きで送り、金額を含めない。2xx で配送済み", async () => {
    const { deps, store, row } = await queued();
    const { sent, impl } = fakeFetch(200);
    expect(await deliverWebhook(deps, store.webhooks[0], impl)).toBe(true);
    const body = String(sent[0].init.body);
    expect(JSON.parse(body)).toEqual({
      type: "payment.succeeded",
      payment_id: row.payment_id,
      order_id: row.order_id,
      occurred_at: "2026-09-28T12:05:00+09:00",
    });
    expect(body).not.toContain("amount");
    const header = (sent[0].init.headers as Record<string, string>)["X-UD-Signature"];
    const nowSec = Math.floor(new Date("2026-09-28T03:00:00Z").getTime() / 1000);
    expect(verifyRequestSignature({ header, body, secrets: [SECRET], nowSec }).ok).toBe(true);
    expect(store.webhooks[0]).toMatchObject({ attempt: 1, status_code: 200, next_retry_at: null });
    expect(store.webhooks[0].delivered_at).not.toBeNull();
  });

  it("失敗は再送を予約し、6回目で打ち切る", async () => {
    const { deps, store } = await queued();
    const { impl } = fakeFetch(500);
    expect(await deliverWebhook(deps, store.webhooks[0], impl)).toBe(false);
    expect(store.webhooks[0]).toMatchObject({ attempt: 1, error_message: "HTTP 500", next_retry_at: "2026-09-28T03:01:00.000Z" });
    store.webhooks[0].attempt = 5;
    await deliverWebhook(deps, store.webhooks[0], fakeFetch(new Error("ECONNREFUSED")).impl);
    expect(store.webhooks[0]).toMatchObject({ attempt: 6, next_retry_at: null, delivered_at: null });
  });

  it("期限の来た通知だけを送る", async () => {
    const { deps, store } = await queued();
    store.webhooks[0].next_retry_at = "2026-09-28T03:10:00.000Z";
    expect(await deliverDueWebhooks(deps, 20, fakeFetch(200).impl)).toEqual({ attempted: 0, delivered: 0 });
    store.webhooks[0].next_retry_at = "2026-09-28T02:59:00.000Z";
    expect(await deliverDueWebhooks(deps, 20, fakeFetch(204).impl)).toEqual({ attempted: 1, delivered: 1 });
  });

  it("同じ決済・同じ種別の通知は1本しか積まない", async () => {
    const { store, row } = await queued();
    await store.enqueueWebhook({
      merchantPaymentId: row.id,
      eventType: "payment.succeeded",
      occurredAt: "2026-09-28T03:06:00.000Z",
      url: "https://ainylive.com/api/ud/webhook",
    });
    expect(store.webhooks).toHaveLength(1);
  });
});
