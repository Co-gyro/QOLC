import { describe, expect, it } from "vitest";
import { ERROR_HTTP_STATUS, MerchantApiError, toMerchantApiError } from "@/lib/merchant-api/errors";

describe("MerchantApiError（接続仕様書 第13章）", () => {
  it("仕様どおりの本文とHTTPステータス", () => {
    const e = new MerchantApiError("event_date_out_of_range", "公演日が販売可能期間を超えています", {
      max_event_date: "2026-12-01",
    });
    expect(e.status).toBe(400);
    expect(e.toBody()).toEqual({
      error: {
        code: "event_date_out_of_range",
        message: "公演日が販売可能期間を超えています",
        detail: { max_event_date: "2026-12-01" },
      },
    });
  });

  it("表のステータスと一致する", () => {
    expect(ERROR_HTTP_STATUS).toMatchObject({
      signature_invalid: 401,
      merchant_suspended: 403,
      payment_not_found: 404,
      order_id_conflict: 409,
      session_expired: 410,
      limit_exceeded: 422,
      rate_limited: 429,
      service_unavailable: 503,
    });
  });

  it("想定外の例外は internal_error にして内部情報を出さない", () => {
    const e = toMerchantApiError(new Error("relation merchant_payments does not exist"));
    expect(e.code).toBe("internal_error");
    expect(e.message).not.toContain("relation");
  });
});
