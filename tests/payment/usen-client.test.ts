/**
 * usen-client（XMLパース / postForm / joinUrl）のテスト
 */
import { describe, it, expect } from "vitest";
import {
  joinUrl,
  parseXmlResponse,
  postForm,
  isOk,
} from "../../src/lib/payment/usen-client";
import { UsenApiError } from "../../src/lib/payment/errors";

describe("joinUrl", () => {
  it("重複スラッシュを吸収", () => {
    expect(joinUrl("https://x.jp/payment", "/member/authbymemberid")).toBe(
      "https://x.jp/payment/member/authbymemberid"
    );
    expect(joinUrl("https://x.jp/payment/", "member/get")).toBe(
      "https://x.jp/payment/member/get"
    );
  });
});

describe("parseXmlResponse", () => {
  it("会員与信照会の XML をパース", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <jutyu_cd>TSJM-0000001</jutyu_cd>
  <result>ok</result>
  <code>01</code>
  <ucorp>VISA</ucorp>
</response>`;
    const r = parseXmlResponse(xml);
    expect(r.jutyu_cd).toBe("TSJM-0000001");
    expect(r.result).toBe("ok");
    expect(r.code).toBe("01");
    expect(r.ucorp).toBe("VISA");
  });

  it("売上計上の process_day も取得", () => {
    const xml = `<response><jutyu_cd>TSJM-0000001</jutyu_cd><result>ok</result><code>40</code><ucorp>JCB</ucorp><process_day>2026/05/26</process_day></response>`;
    const r = parseXmlResponse(xml);
    expect(r.result).toBe("ok");
    expect(r.code).toBe("40");
    expect(r.process_day).toBe("2026/05/26");
  });

  it("result=ng も取得できる", () => {
    const xml = `<response><jutyu_cd>TSJM-0000001</jutyu_cd><result>ng</result><code>41</code></response>`;
    const r = parseXmlResponse(xml);
    expect(r.result).toBe("ng");
    expect(r.code).toBe("41");
  });

  it("XMLエンティティをデコード", () => {
    const xml = `<response><remarks>A &amp; B &lt;tag&gt;</remarks></response>`;
    const r = parseXmlResponse(xml);
    expect(r.remarks).toBe("A & B <tag>");
  });

  it("空文字は空オブジェクト", () => {
    expect(parseXmlResponse("")).toEqual({});
  });
});

describe("isOk", () => {
  it("result === 'ok' で true", () => {
    expect(isOk({ result: "ok" })).toBe(true);
    expect(isOk({ result: "ng" })).toBe(false);
    expect(isOk({})).toBe(false);
  });
});

describe("postForm（fetch モック）", () => {
  it("XML文字列を返す & form エンコードで POST", async () => {
    let capturedBody = "";
    let capturedCt = "";
    const fakeFetch: typeof fetch = async (_input, init) => {
      capturedBody = String(init?.body ?? "");
      capturedCt = String((init?.headers as Record<string, string>)["Content-Type"] ?? "");
      return new Response("<response><result>ok</result></response>", { status: 200 });
    };
    const text = await postForm({
      url: "https://x.jp/payment/sales/salesadd",
      params: { jutyu_cd: "TSJM-0000001", amount: 10500, check_cd: "HMabc" },
      fetchImpl: fakeFetch,
    });
    expect(text).toContain("<result>ok</result>");
    expect(capturedCt).toContain("application/x-www-form-urlencoded");
    expect(capturedBody).toMatch(/(^|&)jutyu_cd=TSJM-0000001/);
    expect(capturedBody).toMatch(/(^|&)amount=10500/);
    expect(capturedBody).toMatch(/(^|&)check_cd=HMabc/);
  });

  it("undefined/null パラメータは送らない", async () => {
    let body = "";
    const fakeFetch: typeof fetch = async (_i, init) => {
      body = String(init?.body ?? "");
      return new Response("<response/>");
    };
    await postForm({
      url: "https://x.jp/p",
      params: { a: "1", b: undefined, c: null },
      fetchImpl: fakeFetch,
    });
    expect(body).toMatch(/(^|&)a=1/);
    expect(body).not.toMatch(/(^|&)b=/);
    expect(body).not.toMatch(/(^|&)c=/);
  });

  it("HTTPエラーで UsenApiError", async () => {
    const fakeFetch: typeof fetch = async () => new Response("err", { status: 500 });
    await expect(
      postForm({ url: "https://x.jp/p", params: {}, fetchImpl: fakeFetch })
    ).rejects.toThrow(UsenApiError);
  });

  it("通信エラーで UsenApiError", async () => {
    const fakeFetch: typeof fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    await expect(
      postForm({ url: "https://x.jp/p", params: {}, fetchImpl: fakeFetch })
    ).rejects.toThrow(UsenApiError);
  });
});
