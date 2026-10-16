import { describe, expect, it, vi } from "vitest";
import { refundKindFor, refundPayment, type RefundDeps } from "@/lib/udpay/prod/refund";
import { fakeSupabase, type FakeTables } from "../helpers/fake-supabase";

/** 2026-10-28 09:00(JST) に入金済みの課金1件 */
function tables(status = "captured"): FakeTables {
  return {
    udpay_payments: [
      { id: "p1", status, amount: 11000, usen_jutyu_cd: "A303-0000010", captured_at: "2026-10-28T00:00:00Z" },
    ],
  };
}

function deps(t: FakeTables, nowIso: string, over: Partial<RefundDeps> = {}): RefundDeps {
  return {
    client: fakeSupabase(t),
    salesCancel: vi.fn(async () => ({ result: "ok", code: "40" })),
    authVoid: vi.fn(async () => ({ result: "ok", code: "90" })),
    salesReturn: vi.fn(async () => ({ result: "ok", code: "40" })),
    now: () => new Date(nowIso),
    ...over,
  };
}

describe("refundKindFor", () => {
  it("売上日（日本時間）が今日なら取消、翌日以降は返品", () => {
    expect(refundKindFor("2026-10-28T00:00:00Z", new Date("2026-10-28T14:59:00Z"))).toBe("cancel");
    expect(refundKindFor("2026-10-28T00:00:00Z", new Date("2026-10-28T15:00:00Z"))).toBe("return");
  });
});

describe("refundPayment", () => {
  it("当日は売上取消→与信取消して cancelled（売上日と取消日を USEN の日付で渡す）", async () => {
    const t = tables();
    const d = deps(t, "2026-10-28T05:00:00Z");
    expect(await refundPayment(d, "p1")).toEqual({ ok: true, kind: "cancel" });
    expect(d.salesCancel).toHaveBeenCalledWith({ jutyuCd: "A303-0000010", amount: 11000, salesDay: "2026/10/28" });
    expect(d.authVoid).toHaveBeenCalledWith({ jutyuCd: "A303-0000010", amount: 11000, jutyuDay: "2026/10/28" });
    expect(d.salesReturn).not.toHaveBeenCalled();
    expect(t.udpay_payments[0].status).toBe("cancelled");
  });

  it("当日でも締め後（売上取消 code=41）は返品に切り替える", async () => {
    const t = tables();
    const d = deps(t, "2026-10-28T10:00:00Z", { salesCancel: vi.fn(async () => ({ result: "ng", code: "41" })) });
    expect(await refundPayment(d, "p1")).toEqual({ ok: true, kind: "return" });
    expect(d.salesReturn).toHaveBeenCalledWith({ jutyuCd: "A303-0000010", amount: 11000, salesDay: "2026/10/28" });
    expect(t.udpay_payments[0].status).toBe("refunded");
  });

  it("翌日以降は元の売上日で返品して refunded", async () => {
    const t = tables();
    const d = deps(t, "2026-11-02T01:00:00Z");
    expect(await refundPayment(d, "p1")).toEqual({ ok: true, kind: "return" });
    expect(d.salesCancel).not.toHaveBeenCalled();
    expect(d.salesReturn).toHaveBeenCalledWith(expect.objectContaining({ salesDay: "2026/10/28" }));
  });

  it("返品が失敗したら入金済みに戻す", async () => {
    const t = tables();
    const d = deps(t, "2026-11-02T01:00:00Z", { salesReturn: vi.fn(async () => ({ result: "ng", code: "91" })) });
    expect((await refundPayment(d, "p1")).ok).toBe(false);
    expect(t.udpay_payments[0].status).toBe("captured");
  });

  it("入金済み以外・二重実行は受け付けない", async () => {
    expect((await refundPayment(deps(tables("scheduled"), "2026-10-28T05:00:00Z"), "p1")).ok).toBe(false);
    const t = tables();
    const d = deps(t, "2026-10-28T05:00:00Z");
    await refundPayment(d, "p1");
    expect((await refundPayment(d, "p1")).ok).toBe(false);
    expect(d.salesCancel).toHaveBeenCalledTimes(1);
  });
});
