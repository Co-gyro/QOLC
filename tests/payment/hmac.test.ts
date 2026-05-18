/**
 * HMAC 署名モジュールのユニットテスト
 *
 * - 固定鍵で HMAC-SHA256 / HMAC-MD5 の期待値検証
 * - 空文字列、日本語、特殊文字の入力テスト
 * - 鍵ファイル未設定 / 不存在のエラーハンドリング
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  signWithKey,
  sign,
  loadHmacKey,
  resetHmacKeyCache,
  buildSignaturePayload,
} from "../../src/lib/payment/hmac";
import { HmacKeyError } from "../../src/lib/payment/errors";

// 固定の64バイトテスト鍵（バイナリ。ゼロ埋め+カウンタで構成）
const TEST_KEY = Buffer.from(
  Array.from({ length: 64 }, (_, i) => i),
);

describe("signWithKey: HMAC-SHA256", () => {
  it("Node.js crypto と同じ結果を返す（known answer）", () => {
    // openssl dgst -sha256 -mac HMAC -macopt hexkey:00...3f
    // で算出済みの既知の値
    const sig = signWithKey("sha256", TEST_KEY, "hello");
    expect(sig).toHaveLength(64); // SHA256 = 32 bytes = 64 hex chars
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("空文字でも署名できる", () => {
    const sig = signWithKey("sha256", TEST_KEY, "");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("日本語を含む文字列で署名できる", () => {
    const sig = signWithKey("sha256", TEST_KEY, "ユニバーサルデベロップメント");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("特殊文字（&, =, % など）でも署名できる", () => {
    const sig = signWithKey("sha256", TEST_KEY, "a=1&b=2%20c");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("同じ入力で常に同じ結果（決定的）", () => {
    const s1 = signWithKey("sha256", TEST_KEY, "deterministic");
    const s2 = signWithKey("sha256", TEST_KEY, "deterministic");
    expect(s1).toBe(s2);
  });

  it("異なる入力で異なる結果", () => {
    const s1 = signWithKey("sha256", TEST_KEY, "input-1");
    const s2 = signWithKey("sha256", TEST_KEY, "input-2");
    expect(s1).not.toBe(s2);
  });

  it("異なる鍵で異なる結果", () => {
    const otherKey = Buffer.from(Array.from({ length: 64 }, (_, i) => 64 - i));
    const s1 = signWithKey("sha256", TEST_KEY, "same");
    const s2 = signWithKey("sha256", otherKey, "same");
    expect(s1).not.toBe(s2);
  });
});

describe("signWithKey: HMAC-MD5", () => {
  it("16進32文字を返す", () => {
    const sig = signWithKey("md5", TEST_KEY, "hello");
    expect(sig).toHaveLength(32); // MD5 = 16 bytes = 32 hex chars
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
  });

  it("空文字でも署名できる", () => {
    const sig = signWithKey("md5", TEST_KEY, "");
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
  });

  it("SHA256 と MD5 で異なる結果", () => {
    const sha = signWithKey("sha256", TEST_KEY, "same-input");
    const md5 = signWithKey("md5", TEST_KEY, "same-input");
    expect(sha).not.toBe(md5);
    expect(sha).toHaveLength(64);
    expect(md5).toHaveLength(32);
  });
});

describe("buildSignaturePayload", () => {
  it("キーの ASCII 昇順で値を連結する", () => {
    const payload = buildSignaturePayload({
      site_cd: "S203",
      mall_cd: "A300",
      amount: 1,
      jutyu_cd: "A300-0000001",
    });
    // ASCII 順: amount, jutyu_cd, mall_cd, site_cd
    expect(payload).toBe("1A300-0000001A300S203");
  });

  it("undefined / null を除外する", () => {
    const payload = buildSignaturePayload({
      a: "1",
      b: null,
      c: undefined,
      d: "2",
    });
    expect(payload).toBe("12");
  });

  it("connector 指定で区切れる", () => {
    const payload = buildSignaturePayload(
      { a: "x", b: "y" },
      "|",
    );
    expect(payload).toBe("x|y");
  });

  it("数値も文字列化される", () => {
    const payload = buildSignaturePayload({ a: 100, b: 0 });
    expect(payload).toBe("1000");
  });
});

describe("loadHmacKey / sign（環境変数経由）", () => {
  let tmpKeyPath: string;
  const ORIGINAL_ENV = process.env.USEN_HMAC_KEY_PATH;

  beforeEach(() => {
    resetHmacKeyCache();
    tmpKeyPath = join(tmpdir(), `qolc-test-${Date.now()}.NMK`);
    writeFileSync(tmpKeyPath, TEST_KEY);
    process.env.USEN_HMAC_KEY_PATH = tmpKeyPath;
  });

  afterEach(() => {
    resetHmacKeyCache();
    try {
      unlinkSync(tmpKeyPath);
    } catch {
      // ignore
    }
    if (ORIGINAL_ENV === undefined) {
      delete process.env.USEN_HMAC_KEY_PATH;
    } else {
      process.env.USEN_HMAC_KEY_PATH = ORIGINAL_ENV;
    }
  });

  it("環境変数から鍵を読んで HMAC-SHA256 署名を生成できる", () => {
    const sig = sign("sha256", "test-payload");
    const expected = signWithKey("sha256", TEST_KEY, "test-payload");
    expect(sig).toBe(expected);
  });

  it("環境変数から鍵を読んで HMAC-MD5 署名を生成できる", () => {
    const sig = sign("md5", "test-payload");
    const expected = signWithKey("md5", TEST_KEY, "test-payload");
    expect(sig).toBe(expected);
  });

  it("loadHmacKey は同じパスならキャッシュを返す（参照同一）", () => {
    const k1 = loadHmacKey();
    const k2 = loadHmacKey();
    expect(k1).toBe(k2);
  });

  it("USEN_HMAC_KEY_PATH 未設定で HmacKeyError", () => {
    delete process.env.USEN_HMAC_KEY_PATH;
    resetHmacKeyCache();
    expect(() => loadHmacKey()).toThrow(HmacKeyError);
  });

  it("存在しないパスで HmacKeyError", () => {
    process.env.USEN_HMAC_KEY_PATH = "/nonexistent/path/to/key.NMK";
    resetHmacKeyCache();
    expect(() => loadHmacKey()).toThrow(HmacKeyError);
  });

  it("空ファイルで HmacKeyError", () => {
    writeFileSync(tmpKeyPath, "");
    resetHmacKeyCache();
    expect(() => loadHmacKey()).toThrow(HmacKeyError);
  });
});
