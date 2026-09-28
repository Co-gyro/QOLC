import { describe, expect, it, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import { resolveUsenProfile, UsenProfileError } from "@/lib/merchant-api/usen-profile";
import { resetHmacKeyCache } from "@/lib/payment/hmac";

const siteKey = randomBytes(64);
const testKey = randomBytes(64);

/** 必要な環境変数一式 */
function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    USEN_TOKEN_EC_API_BASE_URL: "https://usen.test/ec-payment-uhup",
    USEN_MEMBER_API_BASE_URL: "https://usen.test/payment",
    USEN_GROUP_ID: "PRODGROUP",
    NEXT_PUBLIC_USEN_TOKEN_JS_URL: "https://cdn.test/prod.js",
    USEN_TEST_GROUP_ID: "TESTGROUP",
    USEN_TEST_MALL_CD: "TSJM",
    USEN_TEST_SITE_HMAC_KEY_B64: testKey.toString("base64"),
    USEN_TEST_TOKEN_JS_URL: "https://cdn.test/dev.js",
    ...overrides,
  } as unknown as NodeJS.ProcessEnv;
}

describe("resolveUsenProfile", () => {
  beforeEach(() => {
    resetHmacKeyCache();
    process.env.USEN_SITE_HMAC_KEY_B64 = siteKey.toString("base64");
  });

  it("production は加盟店のモールコード・本番 group_id・サイト鍵", () => {
    const p = resolveUsenProfile("production", "A304", env());
    expect(p).toMatchObject({ mallCd: "A304", groupId: "PRODGROUP", tokenJsUrl: "https://cdn.test/prod.js" });
    expect(p.key.equals(siteKey)).toBe(true);
  });

  it("test はテストモール・テスト鍵（加盟店のモールコードは使わない）", () => {
    const p = resolveUsenProfile("test", "A304", env());
    expect(p).toMatchObject({ mallCd: "TSJM", groupId: "TESTGROUP", tokenJsUrl: "https://cdn.test/dev.js" });
    expect(p.key.equals(testKey)).toBe(true);
  });

  it("テストと本番の group_id が同じなら止める（実課金防止）", () => {
    expect(() => resolveUsenProfile("test", null, env({ USEN_TEST_GROUP_ID: "PRODGROUP" }))).toThrow(UsenProfileError);
  });

  it("本番でモールコード未設定は止める", () => {
    expect(() => resolveUsenProfile("production", null, env())).toThrow(/モールコード/);
  });

  it("テスト鍵の長さ違い・未設定は止める", () => {
    expect(() =>
      resolveUsenProfile("test", null, env({ USEN_TEST_SITE_HMAC_KEY_B64: randomBytes(32).toString("base64") }))
    ).toThrow(/64バイト/);
    expect(() => resolveUsenProfile("test", null, env({ USEN_TEST_SITE_HMAC_KEY_B64: undefined }))).toThrow(
      UsenProfileError
    );
  });
});
