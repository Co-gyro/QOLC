import { describe, it, expect } from "vitest";

import { verifyLineIdTokenRemote } from "@/lib/line/verify-remote";
import { LineVerificationError } from "@/lib/line/errors";

const CHANNEL_ID = "2010492408";

/** fetch をモックするヘルパー */
function mockFetch(status: number, body: unknown, capture?: (url: string, init: RequestInit) => void) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    capture?.(String(url), init ?? {});
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
}

describe("verifyLineIdTokenRemote", () => {
  it("検証成功時はクレームを返す", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    const f = mockFetch(
      200,
      { iss: "https://access.line.me", sub: "Uabc", aud: CHANNEL_ID, exp: 1, name: "太郎" },
      (url, init) => {
        capturedUrl = url;
        capturedBody = String(init.body);
      }
    );
    const claims = await verifyLineIdTokenRemote("the.id.token", CHANNEL_ID, {}, f);
    expect(claims.sub).toBe("Uabc");
    expect(claims.name).toBe("太郎");
    // 正しいエンドポイントと client_id / id_token を送る
    expect(capturedUrl).toBe("https://api.line.me/oauth2/v2.1/verify");
    expect(capturedBody).toContain("client_id=2010492408");
    expect(capturedBody).toContain("id_token=the.id.token");
  });

  it("nonce 指定時はボディに含める", async () => {
    let capturedBody = "";
    const f = mockFetch(200, { sub: "U1" }, (_u, init) => {
      capturedBody = String(init.body);
    });
    await verifyLineIdTokenRemote("t", CHANNEL_ID, { nonce: "n123" }, f);
    expect(capturedBody).toContain("nonce=n123");
  });

  it("検証失敗(HTTPエラー)は LineVerificationError", async () => {
    const f = mockFetch(400, { error: "invalid_request", error_description: "aud unmatched" });
    await expect(verifyLineIdTokenRemote("t", CHANNEL_ID, {}, f)).rejects.toBeInstanceOf(
      LineVerificationError
    );
  });

  it("sub 欠落は LineVerificationError", async () => {
    const f = mockFetch(200, { iss: "https://access.line.me" });
    await expect(verifyLineIdTokenRemote("t", CHANNEL_ID, {}, f)).rejects.toBeInstanceOf(
      LineVerificationError
    );
  });

  it("通信失敗は LineVerificationError", async () => {
    const f = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(verifyLineIdTokenRemote("t", CHANNEL_ID, {}, f)).rejects.toBeInstanceOf(
      LineVerificationError
    );
  });
});
