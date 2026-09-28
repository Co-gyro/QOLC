import { describe, expect, it } from "vitest";
import {
  abortBodySchema,
  checkoutErrorResponse,
  payBodySchema,
  readBody,
  rejectInvalidSession,
  tokenInitBodySchema,
} from "@/lib/merchant-api/checkout-http";
import { CheckoutError } from "@/lib/merchant-api/service-checkout";
import { newSessionId } from "@/lib/merchant-api/ids";

describe("決済画面の内部エンドポイント", () => {
  it("session_id の形式が不正なら 404", () => {
    expect(rejectInvalidSession("x")?.status).toBe(404);
    expect(rejectInvalidSession(newSessionId())).toBeNull();
  });

  it("SDK からの /token/init の値を検証する（カード名義は半角英数2〜45桁）", () => {
    const ok = { jutyu_cd: "TSJM-0000001", token: "t", card_limit_yyyy: "2028", card_limit_mm: "08", cardholder_name: "TARO" };
    expect(tokenInitBodySchema.safeParse(ok).success).toBe(true);
    expect(tokenInitBodySchema.safeParse({ ...ok, cardholder_name: "TARO YAMADA" }).success).toBe(false);
    expect(tokenInitBodySchema.safeParse({ ...ok, card_limit_mm: "13" }).success).toBe(false);
    expect(tokenInitBodySchema.safeParse({ ...ok, jutyu_cd: "TSJM0000001" }).success).toBe(false);
  });

  it("/pay・/abort の値を検証する", () => {
    expect(payBodySchema.safeParse({ jutyu_cd: "TSJM-0000001", token: "t", check_cd: "HMab12" }).success).toBe(true);
    expect(payBodySchema.safeParse({ jutyu_cd: "TSJM-0000001", token: "t", check_cd: "xx" }).success).toBe(false);
    expect(abortBodySchema.safeParse({ jutyu_cd: "TSJM-0000001", error_type: "NG_3DS_BRW_AUTH" }).success).toBe(true);
    expect(abortBodySchema.safeParse({ jutyu_cd: "TSJM-0000001", error_type: "OTHER" }).success).toBe(false);
  });

  it("readBody は JSON 不正・検証失敗で null", async () => {
    const bad = new Request("https://x.test", { method: "POST", body: "{" });
    expect(await readBody(bad, abortBodySchema)).toBeNull();
    const good = new Request("https://x.test", {
      method: "POST",
      body: JSON.stringify({ jutyu_cd: "TSJM-0000001", error_type: "NETWORK" }),
    });
    expect(await readBody(good, abortBodySchema)).toEqual({ jutyu_cd: "TSJM-0000001", error_type: "NETWORK" });
  });

  it("購入者向けエラーは文言をそのまま、想定外は一般的な文言", async () => {
    const res = checkoutErrorResponse(new CheckoutError(409, "処理中です"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("処理中です");
    const internal = checkoutErrorResponse(new Error("secret detail"));
    expect(internal.status).toBe(500);
    expect(JSON.stringify(await internal.json())).not.toContain("secret detail");
  });
});
