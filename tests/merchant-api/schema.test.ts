import { describe, expect, it } from "vitest";
import {
  isAllowedRedirectUrl,
  parseCreateSessionInput,
  validateSessionBusinessRules,
  type CreateSessionInput,
  type SessionPolicy,
} from "@/lib/merchant-api/schema";
import { MerchantApiError } from "@/lib/merchant-api/errors";

/** 接続仕様書 第6章のリクエスト例 */
function sample(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  return {
    order_id: "AINY-20260912-000123",
    amount: 6000,
    event: { event_id: "RELIT-VOL13", event_name: "ReLIT定期公演vol.13", event_date: "2026-10-12" },
    items: [{ name: "一般チケット", unit_price: 3000, quantity: 2 }],
    customer: { email: "buyer@example.com" },
    return_url: "https://ainylive.com/checkout/return",
    cancel_url: "https://ainylive.com/checkout/cancel",
    expires_in: 1800,
    ...overrides,
  };
}

const policy: SessionPolicy = {
  environment: "production",
  allowedDomains: ["ainylive.com"],
  maxEventMonths: 3,
  amountLimitPerPayment: null,
  maxExpiresIn: 3600,
};
// JST 2026-09-28 12:00
const now = new Date("2026-09-28T03:00:00Z");

/** 例外のエラーコードを取り出す */
function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof MerchantApiError ? e.code : "other";
  }
}

describe("parseCreateSessionInput", () => {
  it("仕様書の例を受け付ける", () => {
    expect(parseCreateSessionInput(sample()).order_id).toBe("AINY-20260912-000123");
  });

  it("order_id は英数とハイフンのみ", () => {
    expect(codeOf(() => parseCreateSessionInput(sample({ order_id: "AINY_1" })))).toBe("invalid_request");
    expect(codeOf(() => parseCreateSessionInput(sample({ order_id: "A".repeat(65) })))).toBe("invalid_request");
  });

  it("必須項目の欠落・型違い", () => {
    const { customer: _c, ...noCustomer } = sample();
    expect(codeOf(() => parseCreateSessionInput(noCustomer))).toBe("invalid_request");
    expect(codeOf(() => parseCreateSessionInput({ ...sample(), amount: "6000" }))).toBe("invalid_request");
    expect(codeOf(() => parseCreateSessionInput({ ...sample(), amount: 60.5 }))).toBe("invalid_request");
  });
});

describe("validateSessionBusinessRules", () => {
  it("正常系は expires_in を返す（省略時 1800）", () => {
    expect(validateSessionBusinessRules(sample(), policy, now)).toEqual({ expiresIn: 1800 });
    expect(validateSessionBusinessRules(sample({ expires_in: undefined }), policy, now)).toEqual({ expiresIn: 1800 });
  });

  it("items 合計の不一致は amount_mismatch", () => {
    expect(codeOf(() => validateSessionBusinessRules(sample({ amount: 6001 }), policy, now))).toBe("amount_mismatch");
  });

  it("公演日: 当日は可・過去と3か月超は不可（T-12）", () => {
    const at = (event_date: string) => sample({ event: { ...sample().event, event_date } });
    expect(codeOf(() => validateSessionBusinessRules(at("2026-09-28"), policy, now))).toBeNull();
    expect(codeOf(() => validateSessionBusinessRules(at("2026-12-28"), policy, now))).toBeNull();
    expect(codeOf(() => validateSessionBusinessRules(at("2026-12-29"), policy, now))).toBe("event_date_out_of_range");
    expect(codeOf(() => validateSessionBusinessRules(at("2026-09-27"), policy, now))).toBe("event_date_out_of_range");
  });

  it("販売可能期間の上限を detail で返す", () => {
    try {
      validateSessionBusinessRules(sample({ event: { ...sample().event, event_date: "2027-03-01" } }), policy, now);
    } catch (e) {
      expect((e as MerchantApiError).detail).toEqual({ min_event_date: "2026-09-28", max_event_date: "2026-12-28" });
    }
  });

  it("届出のない戻り先は return_url_not_allowed", () => {
    expect(codeOf(() => validateSessionBusinessRules(sample({ return_url: "https://evil.example/x" }), policy, now))).toBe(
      "return_url_not_allowed"
    );
    expect(codeOf(() => validateSessionBusinessRules(sample({ cancel_url: "https://evil.example/x" }), policy, now))).toBe(
      "return_url_not_allowed"
    );
  });

  it("金額上限（USEN 7桁・加盟店ごとの上限）は limit_exceeded", () => {
    const big = sample({ amount: 10_000_000, items: [{ name: "x", unit_price: 5_000_000, quantity: 2 }] });
    expect(codeOf(() => validateSessionBusinessRules(big, policy, now))).toBe("limit_exceeded");
    expect(codeOf(() => validateSessionBusinessRules(sample(), { ...policy, amountLimitPerPayment: 5000 }, now))).toBe(
      "limit_exceeded"
    );
  });

  it("expires_in の範囲外は invalid_request", () => {
    expect(codeOf(() => validateSessionBusinessRules(sample({ expires_in: 3601 }), policy, now))).toBe("invalid_request");
    expect(codeOf(() => validateSessionBusinessRules(sample({ expires_in: 299 }), policy, now))).toBe("invalid_request");
  });
});

describe("isAllowedRedirectUrl", () => {
  it("https かつ届出ホストのみ", () => {
    expect(isAllowedRedirectUrl("https://ainylive.com/a", ["ainylive.com"], "production")).toBe(true);
    expect(isAllowedRedirectUrl("https://www.ainylive.com/a", ["ainylive.com"], "production")).toBe(false);
    expect(isAllowedRedirectUrl("https://ainylive.com.evil.example/a", ["ainylive.com"], "production")).toBe(false);
    expect(isAllowedRedirectUrl("http://ainylive.com/a", ["ainylive.com"], "production")).toBe(false);
    expect(isAllowedRedirectUrl("https://user:pw@ainylive.com/a", ["ainylive.com"], "production")).toBe(false);
    expect(isAllowedRedirectUrl("javascript:alert(1)", ["ainylive.com"], "production")).toBe(false);
  });

  it("*. はサブドメインのみ許可", () => {
    expect(isAllowedRedirectUrl("https://stg.ainylive.com/a", ["*.ainylive.com"], "test")).toBe(true);
    expect(isAllowedRedirectUrl("https://ainylive.com/a", ["*.ainylive.com"], "test")).toBe(false);
    expect(isAllowedRedirectUrl("https://xainylive.com/a", ["*.ainylive.com"], "test")).toBe(false);
  });

  it("http://localhost は test 環境のみ", () => {
    expect(isAllowedRedirectUrl("http://localhost:3000/r", [], "test")).toBe(true);
    expect(isAllowedRedirectUrl("http://localhost:3000/r", [], "production")).toBe(false);
  });
});
