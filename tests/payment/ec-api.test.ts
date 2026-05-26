/**
 * 3DセキュアEC決済API（ec-api）のテスト
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCheckoutForm,
  verifyReturnCheckCode,
  isRegistrationSuccess,
} from "../../src/lib/payment/ec-api";
import { generateCheckCodeWithKey, resetHmacKeyCache } from "../../src/lib/payment/hmac";

const TEST_KEY = Buffer.from(Array.from({ length: 64 }, (_, i) => i));

describe("ec-api", () => {
  let siteKeyPath: string;
  const ORIG_SITE = process.env.USEN_SITE_HMAC_KEY_PATH;
  const ORIG_BASE = process.env.USEN_EC_API_BASE_URL;

  beforeEach(() => {
    resetHmacKeyCache();
    siteKeyPath = join(tmpdir(), `qolc-ec-site-${Date.now()}.NMK`);
    writeFileSync(siteKeyPath, TEST_KEY);
    process.env.USEN_SITE_HMAC_KEY_PATH = siteKeyPath;
    process.env.USEN_EC_API_BASE_URL = "https://inet-uketsuke.netmove.jp/ec-payment-front";
  });

  afterEach(() => {
    resetHmacKeyCache();
    try { unlinkSync(siteKeyPath); } catch { /* ignore */ }
    if (ORIG_SITE === undefined) delete process.env.USEN_SITE_HMAC_KEY_PATH;
    else process.env.USEN_SITE_HMAC_KEY_PATH = ORIG_SITE;
    if (ORIG_BASE === undefined) delete process.env.USEN_EC_API_BASE_URL;
    else process.env.USEN_EC_API_BASE_URL = ORIG_BASE;
  });

  it("checkout フォームに check_cd(HM+SHA256 of jutyu_cd,sum_price) を付与", () => {
    const form = buildCheckoutForm(
      { jutyu_cd: "TSJL-0000001", sum_price: 1, jutyu_day: "2026/05/26", member_id: "Mabc" },
      "site"
    );
    expect(form.method).toBe("POST");
    expect(form.url).toBe("https://inet-uketsuke.netmove.jp/ec-payment-front/checkout");
    expect(form.fields.jutyu_cd).toBe("TSJL-0000001");
    expect(form.fields.sum_price).toBe("1");
    expect(form.fields.member_id).toBe("Mabc");
    expect(form.fields.check_cd).toBe(
      generateCheckCodeWithKey("sha256", TEST_KEY, ["TSJL-0000001", 1])
    );
  });

  it("undefined パラメータはフィールドに含めない", () => {
    const form = buildCheckoutForm(
      { jutyu_cd: "TSJL-0000001", sum_price: 1, jutyu_day: "2026/05/26" },
      "site"
    );
    expect(form.fields.member_id).toBeUndefined();
    expect(form.fields.item_name).toBeUndefined();
  });

  it("ret_url の check_cd を検証（jutyu_cd,user_card_corp,sum_price）", () => {
    const jutyu_cd = "TSJL-0000001";
    const user_card_corp = "VISA";
    const sumPrice = 1;
    const validCheck = generateCheckCodeWithKey("sha256", TEST_KEY, [
      jutyu_cd,
      user_card_corp,
      sumPrice,
    ]);
    expect(verifyReturnCheckCode({ jutyu_cd, user_card_corp, check_cd: validCheck }, sumPrice, "site")).toBe(true);
    expect(verifyReturnCheckCode({ jutyu_cd, user_card_corp, check_cd: "HMdeadbeef" }, sumPrice, "site")).toBe(false);
  });

  it("isRegistrationSuccess は member_id 非ブランクで true", () => {
    expect(isRegistrationSuccess({ member_id: "Mabc" })).toBe(true);
    expect(isRegistrationSuccess({ member_id: "" })).toBe(false);
    expect(isRegistrationSuccess({})).toBe(false);
  });
});
