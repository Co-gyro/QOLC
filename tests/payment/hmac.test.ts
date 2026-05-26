/**
 * チェックコード（署名）モジュールのテスト（IF仕様書 2.4.2 / EC導入ガイド 4.2.3 準拠）
 *
 * - "HM" プレフィックス
 * - 指定フィールドを "," 連結してハッシュ
 * - HMAC-MD5（会員ID）/ HMAC-SHA256（EC）
 * - サイト鍵 / モール鍵を環境変数パスからロード
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  hmacHex,
  generateCheckCodeWithKey,
  generateCheckCode,
  loadUsenKey,
  resetHmacKeyCache,
  CHECK_CODE_PREFIX,
} from "../../src/lib/payment/hmac";
import { HmacKeyError } from "../../src/lib/payment/errors";

// 64バイトの固定テスト鍵
const TEST_KEY = Buffer.from(Array.from({ length: 64 }, (_, i) => i));

describe("hmacHex", () => {
  it("HMAC-MD5 は16進32文字", () => {
    const h = hmacHex("md5", TEST_KEY, "TSJM-0000001,10500");
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    // Node crypto と一致
    const expected = createHmac("md5", TEST_KEY).update("TSJM-0000001,10500", "utf8").digest("hex");
    expect(h).toBe(expected);
  });

  it("HMAC-SHA256 は16進64文字", () => {
    const h = hmacHex("sha256", TEST_KEY, "TSJL-0000001,1");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    const expected = createHmac("sha256", TEST_KEY).update("TSJL-0000001,1", "utf8").digest("hex");
    expect(h).toBe(expected);
  });
});

describe("generateCheckCodeWithKey", () => {
  it("先頭に 'HM' を付与する", () => {
    const cc = generateCheckCodeWithKey("md5", TEST_KEY, ["TSJM-0000001", 10500]);
    expect(cc.startsWith(CHECK_CODE_PREFIX)).toBe(true);
    expect(cc).toBe("HM" + hmacHex("md5", TEST_KEY, "TSJM-0000001,10500"));
  });

  it("フィールドを ',' で連結（順序保持）", () => {
    const cc = generateCheckCodeWithKey("sha256", TEST_KEY, ["A", "B", "C"]);
    expect(cc).toBe("HM" + hmacHex("sha256", TEST_KEY, "A,B,C"));
  });

  it("単一フィールドはカンマなし（search/trade 想定）", () => {
    const cc = generateCheckCodeWithKey("md5", TEST_KEY, ["TSJM-0000001"]);
    expect(cc).toBe("HM" + hmacHex("md5", TEST_KEY, "TSJM-0000001"));
  });

  it("数値も文字列化して連結", () => {
    const cc = generateCheckCodeWithKey("md5", TEST_KEY, ["x", 1]);
    expect(cc).toBe("HM" + hmacHex("md5", TEST_KEY, "x,1"));
  });

  it("会員ID(MD5) と EC(SHA256) で結果が異なる", () => {
    const md5 = generateCheckCodeWithKey("md5", TEST_KEY, ["TSJM-0000001", 100]);
    const sha = generateCheckCodeWithKey("sha256", TEST_KEY, ["TSJM-0000001", 100]);
    expect(md5).not.toBe(sha);
    expect(md5).toHaveLength(2 + 32);
    expect(sha).toHaveLength(2 + 64);
  });
});

describe("loadUsenKey / generateCheckCode（環境変数経由）", () => {
  let siteKeyPath: string;
  let mallKeyPath: string;
  const ORIG_SITE = process.env.USEN_SITE_HMAC_KEY_PATH;
  const ORIG_MALL = process.env.USEN_MALL_HMAC_KEY_PATH;

  beforeEach(() => {
    resetHmacKeyCache();
    siteKeyPath = join(tmpdir(), `qolc-site-${Date.now()}.NMK`);
    mallKeyPath = join(tmpdir(), `qolc-mall-${Date.now()}.NMK`);
    writeFileSync(siteKeyPath, TEST_KEY);
    writeFileSync(mallKeyPath, Buffer.from(Array.from({ length: 64 }, (_, i) => 64 - i)));
    process.env.USEN_SITE_HMAC_KEY_PATH = siteKeyPath;
    process.env.USEN_MALL_HMAC_KEY_PATH = mallKeyPath;
  });

  afterEach(() => {
    resetHmacKeyCache();
    for (const p of [siteKeyPath, mallKeyPath]) {
      try { unlinkSync(p); } catch { /* ignore */ }
    }
    if (ORIG_SITE === undefined) delete process.env.USEN_SITE_HMAC_KEY_PATH;
    else process.env.USEN_SITE_HMAC_KEY_PATH = ORIG_SITE;
    if (ORIG_MALL === undefined) delete process.env.USEN_MALL_HMAC_KEY_PATH;
    else process.env.USEN_MALL_HMAC_KEY_PATH = ORIG_MALL;
  });

  it("サイト鍵でチェックコードを生成できる", () => {
    const cc = generateCheckCode("sha256", "site", ["TSJL-0000001", 1]);
    expect(cc).toBe(generateCheckCodeWithKey("sha256", TEST_KEY, ["TSJL-0000001", 1]));
  });

  it("サイト鍵とモール鍵で結果が異なる", () => {
    const site = generateCheckCode("md5", "site", ["TSJM-0000001", 100]);
    const mall = generateCheckCode("md5", "mall", ["TSJM-0000001", 100]);
    expect(site).not.toBe(mall);
  });

  it("loadUsenkey は同一パスでキャッシュを返す", () => {
    const k1 = loadUsenKey("site");
    const k2 = loadUsenKey("site");
    expect(k1).toBe(k2);
  });

  it("環境変数未設定で HmacKeyError", () => {
    delete process.env.USEN_SITE_HMAC_KEY_PATH;
    resetHmacKeyCache();
    expect(() => loadUsenKey("site")).toThrow(HmacKeyError);
  });

  it("存在しないパスで HmacKeyError", () => {
    process.env.USEN_MALL_HMAC_KEY_PATH = "/nonexistent/x.NMK";
    resetHmacKeyCache();
    expect(() => loadUsenKey("mall")).toThrow(HmacKeyError);
  });
});
