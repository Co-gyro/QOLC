import { describe, expect, it } from "vitest";
import {
  customerIdFromUdpayMemberId,
  isRegistrationToken,
  newRegistrationToken,
  registrationUrl,
  udpayMemberId,
} from "@/lib/udpay/prod/identifiers";

const ID = "3f4c3935-fc27-4721-b2d6-8d6f56aec41d";

describe("udpayMemberId", () => {
  it("U＋ハイフン抜きの顧客ID（33桁）で、QOLCの M 始まりと区別できる", () => {
    const m = udpayMemberId(ID);
    expect(m).toBe("U3f4c3935fc274721b2d68d6f56aec41d");
    expect(m).toHaveLength(33);
    expect(customerIdFromUdpayMemberId(m)).toBe(ID);
  });
  it("不正な値は扱わない", () => {
    expect(() => udpayMemberId("abc")).toThrow();
    expect(customerIdFromUdpayMemberId("M3f4c3935fc274721b2d68d6f56aec41d")).toBeNull();
  });
});

describe("registration token / url", () => {
  it("32文字の推測困難なトークンを毎回違う値で発行する", () => {
    const a = newRegistrationToken();
    expect(isRegistrationToken(a)).toBe(true);
    expect(a).not.toBe(newRegistrationToken());
    expect(isRegistrationToken("demo-sakura")).toBe(false);
  });
  it("登録リンクの URL", () => {
    expect(registrationUrl("x".repeat(32), "https://app.qolc.jp/")).toBe(`https://app.qolc.jp/pay/udpay/${"x".repeat(32)}`);
  });
});
