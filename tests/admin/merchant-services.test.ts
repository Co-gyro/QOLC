import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canAddSeat, listMerchantServices, saveMerchantService } from "@/lib/admin/merchant-services";
import { fakeSupabase, type FakeTables } from "../helpers/fake-supabase";

function tables(over: Record<string, unknown> = {}): FakeTables {
  return {
    merchant_services: [
      { id: "s1", merchant_id: "m1", service: "udpay", status: "active", plan_name: "UD Payment", seat_limit: 3, started_on: "2026-10-20", ended_on: null, notes: null, updated_at: "2026-10-20T00:00:00Z", deleted_at: null, ...over },
    ],
    udpay_members: [
      { user_id: "u1", merchant_id: "m1", deleted_at: null },
      { user_id: "u2", merchant_id: "m1", deleted_at: null },
      { user_id: "u3", merchant_id: "m1", deleted_at: "2026-10-01T00:00:00Z" },
    ],
  };
}

describe("listMerchantServices", () => {
  it("利用中の人数は停止（削除）されていない利用者だけを数える", async () => {
    const r = await listMerchantServices(fakeSupabase(tables()), "m1");
    expect(r.ready).toBe(true);
    expect(r.services[0]).toMatchObject({ service: "udpay", planName: "UD Payment", seatLimit: 3, seatsUsed: 2 });
  });
  it("テーブルが無い（migration 041 未適用）なら ready=false", async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ is: async () => ({ data: null, error: { code: "PGRST205", message: "merchant_services not found" } }) }) }) }) } as unknown as SupabaseClient;
    expect(await listMerchantServices(client, "m1")).toEqual({ ready: false, services: [] });
  });
});

describe("canAddSeat", () => {
  it("上限未満なら発行できる、上限に達したら止める", async () => {
    expect(await canAddSeat(fakeSupabase(tables()), "m1", "udpay")).toEqual({ ok: true });
    const r = await canAddSeat(fakeSupabase(tables({ seat_limit: 2 })), "m1", "udpay");
    expect(r.ok).toBe(false);
  });
  it("一時停止・解約の契約では発行させない／契約が無ければ制限しない", async () => {
    expect((await canAddSeat(fakeSupabase(tables({ status: "suspended" })), "m1", "udpay")).ok).toBe(false);
    expect(await canAddSeat(fakeSupabase(tables()), "m1", "qolc")).toEqual({ ok: true });
  });
});

describe("saveMerchantService", () => {
  it("同じサービスがあれば更新、無ければ追加", async () => {
    const t = tables();
    await saveMerchantService(fakeSupabase(t), "m1", { service: "udpay", status: "suspended", planName: "スタンダード", seatLimit: 5 }, "admin");
    expect(t.merchant_services[0]).toMatchObject({ status: "suspended", plan_name: "スタンダード", seat_limit: 5 });
    await saveMerchantService(fakeSupabase(t), "m1", { service: "merchant_api", status: "active", startedOn: "" }, "admin");
    expect(t.merchant_services).toHaveLength(2);
    expect(t.merchant_services[1]).toMatchObject({ service: "merchant_api", started_on: null, created_by: "admin" });
  });
});
