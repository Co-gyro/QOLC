import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  SELFISH_HEADERS,
  SELFISH_SIGNATURE_MAX_SKEW_SEC,
  buildSelfishSigningString,
  signSelfishRequest,
  verifySelfishSignature,
} from "@/lib/selfish/signature";

const KEY = "test-shared-key";
const BODY = '{"schema":"qolc.merchant.v1","external_id":"x"}';

describe("Selfish 連携署名（QOLC→Selfish の契約）", () => {
  it("ヘッダ名は X-Qolc-* で固定", () => {
    expect(SELFISH_HEADERS).toEqual({
      timestamp: "X-Qolc-Timestamp",
      requestId: "X-Qolc-Request-Id",
      signature: "X-Qolc-Signature",
    });
  });

  it("署名対象は timestamp / requestId / body を改行で連結した文字列", () => {
    expect(buildSelfishSigningString("1700000000", "rid", BODY)).toBe(`1700000000\nrid\n${BODY}`);
  });

  it("署名は HMAC-SHA256 hex（Selfish 側の参照値と一致）", () => {
    const expected = createHmac("sha256", KEY)
      .update(`1700000000\nrid\n${BODY}`, "utf8")
      .digest("hex");
    expect(signSelfishRequest(KEY, "1700000000", "rid", BODY)).toBe(expected);
    expect(signSelfishRequest(KEY, "1700000000", "rid", BODY)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("往復: 正しい署名は通り、本文改ざん・鍵違い・時刻ずれは拒否", () => {
    const ts = "1700000000";
    const sig = signSelfishRequest(KEY, ts, "rid", BODY);
    const base = { key: KEY, timestamp: ts, requestId: "rid", rawBody: BODY, signature: sig, nowSec: 1700000100 };
    expect(verifySelfishSignature(base)).toEqual({ ok: true });
    expect(verifySelfishSignature({ ...base, signature: sig.toUpperCase() })).toEqual({ ok: true });
    expect(verifySelfishSignature({ ...base, rawBody: BODY + " " })).toEqual({ ok: false, reason: "mismatch" });
    expect(verifySelfishSignature({ ...base, key: "other" })).toEqual({ ok: false, reason: "mismatch" });
    expect(
      verifySelfishSignature({ ...base, nowSec: 1700000000 + SELFISH_SIGNATURE_MAX_SKEW_SEC + 1 })
    ).toEqual({ ok: false, reason: "skew" });
    expect(verifySelfishSignature({ ...base, timestamp: "abc" })).toEqual({ ok: false, reason: "format" });
  });
});
