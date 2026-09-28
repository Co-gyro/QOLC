import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decryptSecret,
  encryptSecret,
  generateMerchantSecret,
  loadEncryptionKey,
} from "@/lib/merchant-api/secret";

describe("署名鍵の暗号化保管", () => {
  const key = randomBytes(32);

  it("暗号化して復号すると元に戻る（毎回異なる暗号文）", () => {
    const secret = generateMerchantSecret("test");
    const a = encryptSecret(secret, key);
    const b = encryptSecret(secret, key);
    expect(a).not.toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
    expect(decryptSecret(a, key)).toBe(secret);
  });

  it("鍵違い・改ざんは例外", () => {
    const enc = encryptSecret("sk_test_x", key);
    expect(() => decryptSecret(enc, randomBytes(32))).toThrow();
    const parts = enc.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptSecret(parts.join(":"), key)).toThrow();
  });

  it("環境で接頭辞が変わる", () => {
    expect(generateMerchantSecret("test")).toMatch(/^sk_test_[A-Za-z0-9_-]{43}$/);
    expect(generateMerchantSecret("production")).toMatch(/^sk_live_/);
  });

  it("暗号鍵は32バイト必須", () => {
    expect(() => loadEncryptionKey({} as unknown as NodeJS.ProcessEnv)).toThrow(/設定されていません/);
    expect(() =>
      loadEncryptionKey({ MERCHANT_API_SECRET_ENC_KEY: randomBytes(16).toString("base64") } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/32バイト/);
    expect(
      loadEncryptionKey({ MERCHANT_API_SECRET_ENC_KEY: key.toString("base64") } as unknown as NodeJS.ProcessEnv).equals(key)
    ).toBe(true);
  });
});
