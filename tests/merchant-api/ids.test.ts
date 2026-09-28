import { describe, expect, it } from "vitest";
import {
  isPaymentId,
  isSessionId,
  newApiMerchantId,
  newPaymentId,
  newSessionId,
  randomBase32,
} from "@/lib/merchant-api/ids";

describe("識別子の採番", () => {
  it("形式と一意性", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newSessionId()));
    expect(ids.size).toBe(500);
    for (const id of Array.from(ids)) expect(isSessionId(id)).toBe(true);
    expect(isPaymentId(newPaymentId())).toBe(true);
  });

  it("紛らわしい文字（I L O U）を使わない", () => {
    expect(randomBase32(2000)).not.toMatch(/[ILOU]/);
  });

  it("加盟店IDは環境の接頭辞付き", () => {
    expect(newApiMerchantId("test")).toMatch(/^mch_test_[0-9A-Z]{16}$/);
    expect(newApiMerchantId("production")).toMatch(/^mch_live_[0-9A-Z]{16}$/);
  });

  it("形式チェックは不正値を弾く", () => {
    expect(isSessionId("cs_short")).toBe(false);
    expect(isSessionId("../etc/passwd")).toBe(false);
    expect(isPaymentId(`pay_${"I".repeat(26)}`)).toBe(false);
  });
});
