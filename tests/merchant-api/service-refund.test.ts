import { describe, expect, it } from "vitest";
import { refundMerchantPayment, RefundError } from "@/lib/merchant-api/service-refund";
import { reconcile } from "@/lib/merchant-api/service-state";
import { makeDeps, makeRow } from "./helpers";

/** 成立済みの決済（JST 2026-10-02 11:42:42 に売上計上） */
function succeeded() {
  return makeRow({
    status: "succeeded",
    amount: 3390,
    usen_jutyu_cd: "TSJM-0000064",
    captured_at: "2026-10-02T02:42:42.000Z",
  });
}

describe("refundMerchantPayment（T-10）", () => {
  it("即時売上返品で全額返金し、refunded にして payment.refunded を積む", async () => {
    const { deps, store, usen, clock } = makeDeps();
    clock.now = new Date("2026-10-08T01:00:00Z");
    const row = succeeded();
    store.payments.push(row);
    const res = await refundMerchantPayment(deps, row.payment_id, "小平");
    expect(usen.calls).toEqual(["refund:TSJM-0000064:3390:2026/10/02"]);
    expect(res.payment.status).toBe("refunded");
    expect(res.payment.refunded_at).toBe("2026-10-08T10:00:00+09:00");
    expect(store.webhooks.map((w) => w.event_type)).toEqual(["payment.refunded"]);
    const log = store.audits.find((a) => a.action === "merchant_refund");
    expect(log?.request).toMatchObject({ jutyu_cd: "TSJM-0000064", amount: 3390, sales_day: "2026/10/02", operator: "小平" });
  });

  it("売上計上日は JST の日付で送る（UTC では前日になる時間帯）", async () => {
    const { deps, store, usen } = makeDeps();
    store.payments.push(makeRow({ status: "succeeded", usen_jutyu_cd: "TSJM-0000001", captured_at: "2026-10-01T16:30:00.000Z" }));
    await refundMerchantPayment(deps, store.payments[0].payment_id, "x");
    expect(usen.calls[0]).toMatch(/:2026\/10\/02$/);
  });

  it("succeeded 以外・返金済み・存在しない決済は返金しない", async () => {
    const { deps, store, usen } = makeDeps();
    store.payments.push(makeRow({ status: "pending" }), makeRow({ status: "refunded", order_id: "R" }));
    await expect(refundMerchantPayment(deps, store.payments[0].payment_id, "x")).rejects.toThrow(/succeeded/);
    await expect(refundMerchantPayment(deps, store.payments[1].payment_id, "x")).rejects.toThrow(/返金済み/);
    await expect(refundMerchantPayment(deps, "pay_X", "x")).rejects.toBeInstanceOf(RefundError);
    expect(usen.calls).toHaveLength(0);
  });

  it("決済日から1年を過ぎたものは返金しない", async () => {
    const { deps, store, clock } = makeDeps();
    store.payments.push(succeeded());
    clock.now = new Date("2027-10-03T00:00:00Z");
    await expect(refundMerchantPayment(deps, store.payments[0].payment_id, "x")).rejects.toThrow(/1年/);
  });

  it("USEN が ng なら状態を変えずにエラー（照会で返金済みと分かれば refunded を返す）", async () => {
    const { deps, store, usen } = makeDeps();
    store.payments.push(succeeded());
    usen.refundResult = { result: "ng", code: "45" };
    usen.trade = { result: "ok", status: "sales" };
    await expect(refundMerchantPayment(deps, store.payments[0].payment_id, "x")).rejects.toThrow(/code=45/);
    expect(store.payments[0].status).toBe("succeeded");

    usen.refundResult = { result: "ng", code: "41" };
    usen.trade = { result: "ok", status: "sales_return" };
    const res = await refundMerchantPayment(deps, store.payments[0].payment_id, "x");
    expect(res.payment.status).toBe("refunded");
  });

  it("通信エラーは状態を変えず、照会してから再実行するよう案内する", async () => {
    const { deps, store, usen } = makeDeps();
    store.payments.push(succeeded());
    usen.refundResult = new Error("timeout");
    await expect(refundMerchantPayment(deps, store.payments[0].payment_id, "x")).rejects.toThrow(/取引照会/);
    expect(store.payments[0].status).toBe("succeeded");
  });
});

describe("返金後の取引照会", () => {
  it("締め前の即時売上返品で void になった成立済み決済は refunded とみなす", async () => {
    const { deps, store, usen } = makeDeps();
    store.payments.push(succeeded());
    usen.trade = { result: "ok", status: "void" };
    expect((await reconcile(deps, store.payments[0])).status).toBe("refunded");
  });

  it("未完了の決済が void でも refunded にはしない", async () => {
    const { deps, store, usen } = makeDeps();
    store.payments.push(makeRow({ status: "pending" }));
    usen.trade = { result: "ok", status: "void" };
    expect((await reconcile(deps, store.payments[0])).status).toBe("pending");
  });
});
