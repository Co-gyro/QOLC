import { describe, expect, it } from "vitest";
import { checkoutPageUrl, failureCodeFromUsen, toPaymentResource, toSessionResource } from "@/lib/merchant-api/serialize";
import { makeRow } from "./helpers";

describe("レスポンス整形", () => {
  it("決済照会（第8章の形）", () => {
    const row = makeRow({
      status: "succeeded",
      card_brand: "JCB",
      card_last4: "1234",
      created_at: "2026-09-08T05:50:02Z",
      captured_at: "2026-09-08T05:52:11Z",
    });
    expect(toPaymentResource(row)).toEqual({
      payment_id: row.payment_id,
      order_id: row.order_id,
      status: "succeeded",
      amount: 6000,
      currency: "JPY",
      event: { event_id: "RELIT-VOL13", event_date: "2026-10-12" },
      card: { brand: "JCB", last4: "1234" },
      created_at: "2026-09-08T14:50:02+09:00",
      captured_at: "2026-09-08T14:52:11+09:00",
      refunded_at: null,
      failure: null,
    });
  });

  it("failed のときだけ failure を返す", () => {
    const r = toPaymentResource(makeRow({ status: "failed", failure_code: "card_declined", failure_message: "x" }));
    expect(r.failure).toEqual({ code: "card_declined", message: "x" });
    expect(r.card).toBeNull();
  });

  it("セッション作成（第6章の形）", () => {
    const row = makeRow({ expires_at: "2026-09-08T06:30:00Z" });
    expect(toSessionResource(row, "https://app.qolc.jp/")).toEqual({
      session_id: row.session_id,
      payment_id: row.payment_id,
      order_id: row.order_id,
      status: "created",
      redirect_url: `https://app.qolc.jp/checkout/${row.session_id}`,
      expires_at: "2026-09-08T15:30:00+09:00",
    });
    expect(checkoutPageUrl("https://a.example", "cs_X")).toBe("https://a.example/checkout/cs_X");
  });

  it("USEN の処理結果詳細コードを失敗理由へ", () => {
    expect(failureCodeFromUsen("02")).toBe("card_declined");
    expect(failureCodeFromUsen("03")).toBe("expired_card");
    expect(failureCodeFromUsen("09")).toBe("three_ds_failed");
    expect(failureCodeFromUsen("04")).toBe("processing_error");
    expect(failureCodeFromUsen(null)).toBe("processing_error");
  });
});
