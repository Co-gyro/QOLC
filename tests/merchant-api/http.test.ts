import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  authenticateMerchantRequest,
  clientIp,
  merchantErrorResponse,
  parseJsonBody,
} from "@/lib/merchant-api/http";
import { MerchantApiError } from "@/lib/merchant-api/errors";
import { buildSignatureHeader } from "@/lib/merchant-api/signature";
import { makeCredential, makeDeps, SECRET } from "./helpers";

const NOW_SEC = Math.floor(new Date("2026-09-28T03:00:00Z").getTime() / 1000);

/** 署名付きリクエストを作る */
function signed(opts: { method?: string; body?: string; merchantId?: string; secret?: string; t?: number } = {}) {
  const method = opts.method ?? "POST";
  const body = method === "GET" ? "" : opts.body ?? '{"order_id":"AINY-1"}';
  return new NextRequest("https://app.qolc.jp/api/merchant/v1/checkout/sessions", {
    method,
    body: method === "GET" ? undefined : body,
    headers: {
      "X-UD-Merchant-Id": opts.merchantId ?? makeCredential().api_merchant_id,
      "X-UD-Signature": buildSignatureHeader(opts.secret ?? SECRET, opts.t ?? NOW_SEC, body),
      "X-Forwarded-For": "203.0.113.5, 10.0.0.1",
    },
  });
}

/** 例外コード */
async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof MerchantApiError ? e.code : "other";
  }
}

describe("authenticateMerchantRequest（第3章）", () => {
  it("正しい署名の POST / GET を通す", async () => {
    const { deps } = makeDeps();
    const post = await authenticateMerchantRequest(signed(), deps);
    expect(post.rawBody).toBe('{"order_id":"AINY-1"}');
    expect(post.credential.api_merchant_id).toBe(makeCredential().api_merchant_id);
    expect((await authenticateMerchantRequest(signed({ method: "GET" }), deps)).rawBody).toBe("");
  });

  it("鍵違い・時刻ずれ・未知の加盟店・失効済みはすべて signature_invalid", async () => {
    const { deps, store } = makeDeps();
    expect(await codeOf(authenticateMerchantRequest(signed({ secret: "wrong" }), deps))).toBe("signature_invalid");
    expect(await codeOf(authenticateMerchantRequest(signed({ t: NOW_SEC - 301 }), deps))).toBe("signature_invalid");
    expect(await codeOf(authenticateMerchantRequest(signed({ merchantId: "mch_test_0000000000000000" }), deps))).toBe(
      "signature_invalid"
    );
    expect(await codeOf(authenticateMerchantRequest(signed({ merchantId: "../x" }), deps))).toBe("signature_invalid");
    store.credentials = [makeCredential({ revoked_at: "2026-09-01T00:00:00Z" })];
    expect(await codeOf(authenticateMerchantRequest(signed(), deps))).toBe("signature_invalid");
  });

  it("署名不一致は理由付きで監査ログに残す", async () => {
    const { deps, store } = makeDeps();
    await codeOf(authenticateMerchantRequest(signed({ secret: "wrong" }), deps));
    const log = store.audits.find((a) => a.action === "merchant_signature_invalid");
    expect(log?.request).toMatchObject({ reason: "mismatch", method: "POST" });
    expect(log?.ipAddress).toBe("203.0.113.5");
  });
});

describe("応答", () => {
  it("業務エラーは仕様の本文とステータス", async () => {
    const res = merchantErrorResponse(new MerchantApiError("payment_not_found", "該当する決済がありません"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "payment_not_found", message: "該当する決済がありません" } });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("想定外の例外は 500 internal_error", async () => {
    const res = merchantErrorResponse(new Error("db down"));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("internal_error");
  });

  it("JSON でないボディは invalid_request", () => {
    expect(() => parseJsonBody("not json")).toThrow(MerchantApiError);
    expect(parseJsonBody('{"a":1}')).toEqual({ a: 1 });
  });

  it("clientIp は X-Forwarded-For の先頭", () => {
    expect(clientIp(signed())).toBe("203.0.113.5");
  });
});
