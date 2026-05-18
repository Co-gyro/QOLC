/**
 * usen-client（HMAC署名 + HTTP通信 + レスポンスパース）の単体テスト
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  callUsenApi,
  parseUrlEncoded,
  joinUrl,
  isUsenSuccess,
} from "../../src/lib/payment/usen-client";
import { resetHmacKeyCache } from "../../src/lib/payment/hmac";
import { UsenApiError } from "../../src/lib/payment/errors";

const TEST_KEY = Buffer.from(Array.from({ length: 64 }, (_, i) => i));

describe("parseUrlEncoded", () => {
  it("通常の key=value&key=value をパース", () => {
    expect(parseUrlEncoded("a=1&b=2&c=3")).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("URLエンコードをデコード", () => {
    expect(parseUrlEncoded("name=%E6%97%A5%E6%9C%AC%E8%AA%9E")).toEqual({
      name: "日本語",
    });
  });

  it("空文字は空オブジェクト", () => {
    expect(parseUrlEncoded("")).toEqual({});
  });

  it("値なしキーは空文字列", () => {
    expect(parseUrlEncoded("flag")).toEqual({ flag: "" });
  });
});

describe("joinUrl", () => {
  it("末尾スラッシュとパスの先頭スラッシュを吸収", () => {
    expect(joinUrl("https://example.com", "/api/x")).toBe("https://example.com/api/x");
    expect(joinUrl("https://example.com/", "/api/x")).toBe("https://example.com/api/x");
    expect(joinUrl("https://example.com/", "api/x")).toBe("https://example.com/api/x");
    expect(joinUrl("https://example.com", "api/x")).toBe("https://example.com/api/x");
  });
});

describe("isUsenSuccess", () => {
  it("res_cd が 'S' なら成功", () => {
    expect(isUsenSuccess({ res_cd: "S" })).toBe(true);
  });
  it("res_cd が '0'/'00'/'OK' でも成功扱い", () => {
    expect(isUsenSuccess({ res_cd: "0" })).toBe(true);
    expect(isUsenSuccess({ res_cd: "00" })).toBe(true);
    expect(isUsenSuccess({ res_cd: "OK" })).toBe(true);
  });
  it("それ以外は失敗", () => {
    expect(isUsenSuccess({ res_cd: "E001" })).toBe(false);
    expect(isUsenSuccess({ })).toBe(false);
  });
});

describe("callUsenApi（fetch モック）", () => {
  let tmpKey: string;

  beforeEach(() => {
    resetHmacKeyCache();
    tmpKey = join(tmpdir(), `qolc-usen-${Date.now()}.NMK`);
    writeFileSync(tmpKey, TEST_KEY);
    process.env.USEN_HMAC_KEY_PATH = tmpKey;
  });

  afterEach(() => {
    resetHmacKeyCache();
    try { unlinkSync(tmpKey); } catch { /* ignore */ }
  });

  it("成功レスポンスをパースして返す", async () => {
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      expect(url).toBe("https://example.com/api/x");
      expect(init?.method).toBe("POST");
      const body = String(init?.body ?? "");
      // 署名フィールド sig が含まれていること
      expect(body).toMatch(/(^|&)sig=/);
      return new Response("res_cd=S&trade_id=T123", {
        status: 200,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
    };
    const resp = await callUsenApi<{ res_cd?: string; trade_id?: string }>({
      url: "https://example.com/api/x",
      params: { site_cd: "TSJL", amount: 1 },
      algorithm: "sha256",
      fetchImpl: fakeFetch,
    });
    expect(resp.res_cd).toBe("S");
    expect(resp.trade_id).toBe("T123");
  });

  it("HTTP エラーで UsenApiError", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response("internal error", { status: 500 });
    await expect(
      callUsenApi({
        url: "https://example.com/api/x",
        params: { a: 1 },
        algorithm: "md5",
        fetchImpl: fakeFetch,
      })
    ).rejects.toThrow(UsenApiError);
  });

  it("ネットワークエラーで UsenApiError", async () => {
    const fakeFetch: typeof fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    await expect(
      callUsenApi({
        url: "https://example.com/api/x",
        params: { a: 1 },
        algorithm: "md5",
        fetchImpl: fakeFetch,
      })
    ).rejects.toThrow(UsenApiError);
  });

  it("undefined/null のパラメータは送信されない", async () => {
    let capturedBody = "";
    const fakeFetch: typeof fetch = async (_input, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response("res_cd=S");
    };
    await callUsenApi({
      url: "https://example.com/api/x",
      params: { a: "1", b: undefined, c: null, d: "2" },
      algorithm: "md5",
      fetchImpl: fakeFetch,
    });
    expect(capturedBody).not.toMatch(/(^|&)b=/);
    expect(capturedBody).not.toMatch(/(^|&)c=/);
    expect(capturedBody).toMatch(/(^|&)a=1/);
    expect(capturedBody).toMatch(/(^|&)d=2/);
  });

  it("JSON 形式のレスポンスもパースできる", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ res_cd: "S", trade_id: "Z9" }), {
        status: 200,
      });
    const resp = await callUsenApi<{ res_cd?: string; trade_id?: string }>({
      url: "https://example.com/api/x",
      params: { a: 1 },
      algorithm: "sha256",
      fetchImpl: fakeFetch,
    });
    expect(resp.trade_id).toBe("Z9");
  });
});
