import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { buildCredential, buildRotation, isValidWebhookUrl, PREVIOUS_SECRET_GRACE_MS } from "@/lib/merchant-api/credentials";
import { decryptSecret } from "@/lib/merchant-api/secret";

const key = randomBytes(32);
const base = {
  merchantId: "08f967cb-c6ca-4a65-a435-f173fb89a5fd",
  environment: "test" as const,
  allowedDomains: ["AinyLive.com ", "*.ainylive.com"],
  webhookUrl: "https://stg.ainylive.com/api/ud/webhook",
};

describe("buildCredential", () => {
  it("平文の鍵は返り値のみ。DB 行は暗号文と末尾4文字", () => {
    const issued = buildCredential(base, key);
    expect(issued.apiMerchantId).toMatch(/^mch_test_/);
    expect(issued.secret).toMatch(/^sk_test_/);
    expect(JSON.stringify(issued.row)).not.toContain(issued.secret);
    expect(decryptSecret(issued.row.secret_enc, key)).toBe(issued.secret);
    expect(issued.row.secret_last4).toBe(issued.secret.slice(-4));
    expect(issued.row.allowed_domains).toEqual(["ainylive.com", "*.ainylive.com"]);
    expect(issued.row).toMatchObject({ max_event_months: 3, max_expires_in: 3600, amount_limit_per_payment: null });
  });

  it("通知先は https かつ届出ドメイン内", () => {
    expect(() => buildCredential({ ...base, webhookUrl: "https://evil.example/hook" }, key)).toThrow();
    expect(() => buildCredential({ ...base, webhookUrl: "http://stg.ainylive.com/hook" }, key)).toThrow();
    expect(isValidWebhookUrl("https://ainylive.com/api/ud/webhook", ["ainylive.com"])).toBe(true);
  });

  it("ドメインの形式不正は拒否", () => {
    expect(() => buildCredential({ ...base, allowedDomains: ["https://ainylive.com"] }, key)).toThrow();
    expect(() => buildCredential({ ...base, allowedDomains: [] }, key)).toThrow();
  });
});

describe("buildRotation", () => {
  it("現行鍵を旧鍵として24時間残す", () => {
    const issued = buildCredential(base, key);
    const now = new Date("2026-09-28T00:00:00Z");
    const { patch, secret } = buildRotation(issued.row, "test", now, key);
    expect(patch.previous_secret_enc).toBe(issued.row.secret_enc);
    expect(new Date(patch.previous_secret_expires_at).getTime() - now.getTime()).toBe(PREVIOUS_SECRET_GRACE_MS);
    expect(decryptSecret(patch.secret_enc, key)).toBe(secret);
    expect(secret).not.toBe(issued.secret);
  });
});
