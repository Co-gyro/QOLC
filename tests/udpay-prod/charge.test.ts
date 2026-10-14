import { describe, expect, it, vi } from "vitest";
import { chargePayment, recoverProcessing, runDueCharges, type ChargeDeps } from "@/lib/udpay/prod/charge";
import { UsenApiError } from "@/lib/payment/errors";
import { fakeSupabase, type FakeTables } from "../helpers/fake-supabase";

/** 決済確定済みの請求1件と課金予定（課金日 2026-10-28） */
function tables(over: Partial<Record<string, unknown>> = {}): FakeTables {
  return {
    udpay_payments: [
      { id: "p1", invoice_id: "i1", customer_id: "c1", merchant_id: "m1", amount: 11000, status: "scheduled", attempt_count: 0, scheduled_date: "2026-10-28", updated_at: "2026-10-27T00:00:00Z", ...over },
    ],
    udpay_invoices: [{ id: "i1", status: "approved" }],
    udpay_customers: [{ id: "c1", usen_member_id: "Uabc" }],
    merchants: [{ id: "m1", mall_code: "A303" }],
  };
}

function deps(t: FakeTables, over: Partial<ChargeDeps> = {}): ChargeDeps {
  return {
    client: fakeSupabase(t),
    nextJutyuCd: vi.fn(async () => "A303-0000010"),
    authByMemberId: vi.fn(async () => ({ result: "ok", code: "01" })),
    salesAdd: vi.fn(async () => ({ result: "ok", code: "40" })),
    searchTrade: vi.fn(async () => ({ result: "ok", status: "sales" })),
    now: () => new Date("2026-10-28T00:00:00Z"),
    ...over,
  };
}

describe("chargePayment", () => {
  it("決済確定の課金を A303 の受注コードで与信・売上計上し captured にする", async () => {
    const t = tables();
    const d = deps(t);
    expect((await chargePayment(d, "p1")).outcome).toBe("captured");
    expect(d.authByMemberId).toHaveBeenCalledWith({ jutyuCd: "A303-0000010", amount: 11000, memberId: "Uabc" });
    expect(d.salesAdd).toHaveBeenCalledWith({ jutyuCd: "A303-0000010", amount: 11000 });
    expect(t.udpay_payments[0]).toMatchObject({ status: "captured", attempt_count: 1, usen_jutyu_cd: "A303-0000010" });
  });

  it("二重に呼んでも課金は1回だけ（2回目は skipped）", async () => {
    const t = tables();
    const d = deps(t);
    await chargePayment(d, "p1");
    expect((await chargePayment(d, "p1")).outcome).toBe("skipped");
    expect(d.authByMemberId).toHaveBeenCalledTimes(1);
  });

  it("与信 NG は failed（与信落ち）でコードを残す", async () => {
    const t = tables();
    const d = deps(t, {
      authByMemberId: vi.fn(async () => {
        throw new UsenApiError("与信失敗", { errorCode: "02" });
      }),
    });
    expect((await chargePayment(d, "p1")).outcome).toBe("failed");
    expect(t.udpay_payments[0]).toMatchObject({ status: "failed", last_error_code: "02" });
    expect(d.salesAdd).not.toHaveBeenCalled();
  });

  it("決済確定でない請求・カード未登録は USEN を呼ばずに failed", async () => {
    const t = tables();
    t.udpay_invoices[0].status = "submitted";
    const d = deps(t);
    expect((await chargePayment(d, "p1")).outcome).toBe("failed");
    expect(d.authByMemberId).not.toHaveBeenCalled();
  });

  it("通信断で結果が不明なら processing のまま残す（翌朝に取引照会で確定）", async () => {
    const t = tables();
    const d = deps(t, { authByMemberId: vi.fn(async () => { throw new Error("socket hang up"); }) });
    expect((await chargePayment(d, "p1")).outcome).toBe("unknown");
    expect(t.udpay_payments[0].status).toBe("processing");
  });
});

describe("recoverProcessing / runDueCharges", () => {
  it("processing のまま残った課金は取引照会で売上済みなら captured", async () => {
    const t = tables({ status: "processing", usen_jutyu_cd: "A303-0000009", updated_at: "2026-10-27T00:00:00Z" });
    const d = deps(t);
    expect(await recoverProcessing(d)).toBe(1);
    expect(t.udpay_payments[0].status).toBe("captured");
  });

  it("与信だけ済んでいたら売上計上して captured", async () => {
    const t = tables({ status: "processing", usen_jutyu_cd: "A303-0000009", updated_at: "2026-10-27T00:00:00Z" });
    const d = deps(t, { searchTrade: vi.fn(async () => ({ result: "ok", status: "auth", auth_result: "ok" })) });
    await recoverProcessing(d);
    expect(d.salesAdd).toHaveBeenCalledWith({ jutyuCd: "A303-0000009", amount: 11000 });
    expect(t.udpay_payments[0].status).toBe("captured");
  });

  it("課金日が来たものだけ課金する（未来日は対象外）", async () => {
    const t = tables();
    expect((await runDueCharges(deps(t), "2026-10-27")).captured).toBe(0);
    expect(t.udpay_payments[0].status).toBe("scheduled");
    expect((await runDueCharges(deps(t), "2026-10-28")).captured).toBe(1);
  });
});
