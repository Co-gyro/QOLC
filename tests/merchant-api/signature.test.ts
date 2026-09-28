import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  buildReturnUrl,
  buildSignatureHeader,
  computeReturnSignature,
  computeSignature,
  parseSignatureHeader,
  verifyRequestSignature,
} from "@/lib/merchant-api/signature";

const SECRET = "sk_test_example";

describe("computeSignature（接続仕様書 第3章）", () => {
  it('HMAC_SHA256(secret, "{t}.{body}") の16進小文字', () => {
    const body = '{"order_id":"AINY-1"}';
    const expected = createHmac("sha256", SECRET).update(`1700000000.${body}`).digest("hex");
    expect(computeSignature(SECRET, 1700000000, body)).toBe(expected);
  });

  it("GET はボディを空文字列として扱う", () => {
    const expected = createHmac("sha256", SECRET).update("1700000000.").digest("hex");
    expect(computeSignature(SECRET, 1700000000, "")).toBe(expected);
  });
});

describe("parseSignatureHeader", () => {
  it("t と v1 を読む（空白を許容）", () => {
    const v1 = "a".repeat(64);
    expect(parseSignatureHeader(`t=123, v1=${v1}`)).toEqual({ timestamp: 123, signatures: [v1] });
  });

  it("形式不正は null", () => {
    expect(parseSignatureHeader(null)).toBeNull();
    expect(parseSignatureHeader("t=abc,v1=xyz")).toBeNull();
    expect(parseSignatureHeader(`v1=${"a".repeat(64)}`)).toBeNull();
    expect(parseSignatureHeader("t=123")).toBeNull();
  });
});

describe("verifyRequestSignature", () => {
  const body = '{"a":1}';
  const now = 1_800_000_000;

  it("正しい署名を受け付ける", () => {
    const header = buildSignatureHeader(SECRET, now, body);
    expect(verifyRequestSignature({ header, body, secrets: [SECRET], nowSec: now })).toEqual({ ok: true });
  });

  it("ボディ改ざんは mismatch（T-08）", () => {
    const header = buildSignatureHeader(SECRET, now, body);
    expect(verifyRequestSignature({ header, body: '{"a":2}', secrets: [SECRET], nowSec: now })).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("5分を超える時刻ずれは拒否、5分ちょうどは許容", () => {
    const header = buildSignatureHeader(SECRET, now, body);
    expect(verifyRequestSignature({ header, body, secrets: [SECRET], nowSec: now + 300 }).ok).toBe(true);
    expect(verifyRequestSignature({ header, body, secrets: [SECRET], nowSec: now + 301 })).toEqual({
      ok: false,
      reason: "timestamp_out_of_range",
    });
  });

  it("再発行直後は旧鍵でも受け付ける", () => {
    const header = buildSignatureHeader("old_secret", now, body);
    expect(verifyRequestSignature({ header, body, secrets: [SECRET, "old_secret"], nowSec: now }).ok).toBe(true);
  });
});

describe("戻りの sig（第7章）", () => {
  it('HMAC_SHA256(secret, "{order_id}.{payment_id}.{status}.{t}")', () => {
    const args = { orderId: "AINY-1", paymentId: "pay_X", status: "succeeded", timestamp: 1700000000 };
    const expected = createHmac("sha256", SECRET).update("AINY-1.pay_X.succeeded.1700000000").digest("hex");
    expect(computeReturnSignature(SECRET, args)).toBe(expected);
  });

  it("buildReturnUrl は既存クエリを保持してパラメータを付ける", () => {
    const url = new URL(
      buildReturnUrl("https://ainylive.com/checkout/return?lang=ja", SECRET, {
        orderId: "AINY-1",
        paymentId: "pay_X",
        status: "cancelled",
        timestamp: 1700000000,
      })
    );
    expect(url.searchParams.get("lang")).toBe("ja");
    expect(url.searchParams.get("status")).toBe("cancelled");
    expect(url.searchParams.get("sig")).toBe(
      computeReturnSignature(SECRET, { orderId: "AINY-1", paymentId: "pay_X", status: "cancelled", timestamp: 1700000000 })
    );
  });
});
