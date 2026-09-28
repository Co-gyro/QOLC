import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseMerchantApiStore } from "@/lib/merchant-api/supabase-store";

type Call = [string, ...unknown[]];

/**
 * クエリビルダーの呼び出しを記録するモック。どのメソッドも自身を返し、
 * await すると result を返す。
 */
function mockClient(result: { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop: string) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      return (...args: unknown[]) => {
        calls.push([prop, ...args]);
        return proxy;
      };
    },
  };
  const proxy = new Proxy(builder, handler);
  return { client: proxy as unknown as SupabaseClient, calls };
}

describe("createSupabaseMerchantApiStore", () => {
  it("updatePayment は前提条件を WHERE に反映する（先取りロック）", async () => {
    const { client, calls } = mockClient({ data: { id: "p1" }, error: null });
    const store = createSupabaseMerchantApiStore(client);
    await store.updatePayment(
      "p1",
      { usen_pay_requested_at: "2026-09-28T03:00:00Z" },
      { statusIn: ["pending"], jutyuCd: "TSJM-0000001", attemptedIsNotNull: true, payRequestedIsNull: true }
    );
    expect(calls).toContainEqual(["from", "merchant_payments"]);
    expect(calls).toContainEqual(["eq", "id", "p1"]);
    expect(calls).toContainEqual(["in", "status", ["pending"]]);
    expect(calls).toContainEqual(["eq", "usen_jutyu_cd", "TSJM-0000001"]);
    expect(calls).toContainEqual(["not", "usen_attempted_at", "is", null]);
    expect(calls).toContainEqual(["is", "usen_pay_requested_at", null]);
  });

  it("insertPayment の一意制約違反は conflict", async () => {
    const { client } = mockClient({ data: null, error: { code: "23505", message: "duplicate" } });
    const store = createSupabaseMerchantApiStore(client);
    const res = await store.insertPayment({} as Parameters<typeof store.insertPayment>[0]);
    expect(res).toBe("conflict");
  });

  it("その他の DB エラーは例外", async () => {
    const { client } = mockClient({ data: null, error: { code: "XX000", message: "boom" } });
    const store = createSupabaseMerchantApiStore(client);
    await expect(store.findPaymentBySessionId("cs_x")).rejects.toThrow(/boom/);
  });

  it("注文IDの検索は加盟店・環境・注文IDで絞り、削除済みを除く", async () => {
    const { client, calls } = mockClient({ data: null, error: null });
    const store = createSupabaseMerchantApiStore(client);
    expect(await store.findPaymentByOrder("m1", "test", "AINY-1")).toBeNull();
    expect(calls).toContainEqual(["eq", "merchant_id", "m1"]);
    expect(calls).toContainEqual(["eq", "environment", "test"]);
    expect(calls).toContainEqual(["eq", "order_id", "AINY-1"]);
    expect(calls).toContainEqual(["is", "deleted_at", null]);
  });

  it("一覧のカーソル条件は値をクォートする", async () => {
    const { client, calls } = mockClient({ data: [], error: null });
    const store = createSupabaseMerchantApiStore(client);
    await store.listPayments({
      merchantId: "m1",
      environment: "test",
      from: "2026-09-27T15:00:00.000Z",
      to: "2026-09-28T15:00:00.000Z",
      limit: 101,
      cursor: { createdAt: "2026-09-28T03:00:00.123+00:00", id: "0b7c0000-0000-4000-8000-000000000000" },
    });
    expect(calls).toContainEqual([
      "or",
      'created_at.gt."2026-09-28T03:00:00.123+00:00",and(created_at.eq."2026-09-28T03:00:00.123+00:00",id.gt.0b7c0000-0000-4000-8000-000000000000)',
    ]);
    expect(calls).toContainEqual(["limit", 101]);
  });

  it("通知は同一決済・同一種別を重複させない（ignoreDuplicates）", async () => {
    const { client, calls } = mockClient({ data: null, error: null });
    const store = createSupabaseMerchantApiStore(client);
    await store.enqueueWebhook({
      merchantPaymentId: "p1",
      eventType: "payment.succeeded",
      occurredAt: "2026-09-28T03:00:00Z",
      url: "https://ainylive.com/hook",
    });
    const upsert = calls.find((c) => c[0] === "upsert");
    expect(upsert?.[2]).toEqual({ onConflict: "merchant_payment_id,event_type", ignoreDuplicates: true });
  });
});
