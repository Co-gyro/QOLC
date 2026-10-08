import { describe, expect, it } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { classifyTrade, usenPay, usenReturn, usenSearchTrade, usenTokenInit } from "@/lib/merchant-api/usen-gateway";
import type { UsenProfile } from "@/lib/merchant-api/usen-profile";

const key = randomBytes(64);
const profile: UsenProfile = {
  environment: "test",
  mallCd: "TSJM",
  groupId: "TESTGROUP",
  key,
  tokenApiBaseUrl: "https://usen.test/ec-payment-uhup",
  memberApiBaseUrl: "https://usen.test/payment",
  tokenJsUrl: "https://cdn.test/dev.js",
  sdkApiBaseUrl: null,
};

/** 送信内容を記録する fetch */
function recorder(responseBody: string) {
  const calls: Array<{ url: string; body: string }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body) });
    return new Response(responseBody, { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("usenTokenInit（トークン式EC決済API 8.1）", () => {
  it("check_cd=HM+HMAC-SHA256(jutyu_cd,sum_price)・即時売上・group_id・3DS連絡先", async () => {
    const { calls, fetchImpl } = recorder('{"result":"ok","code":"01"}');
    await usenTokenInit(
      profile,
      {
        jutyuCd: "TSJM-0000123",
        amount: 6000,
        jutyuDay: "2026/09/28",
        expirationDate: "2026/09/28 12:30",
        token: "TOKEN",
        cardLimitYyyy: "2028",
        cardLimitMm: "08",
        cardholderName: "TARO",
        email: "buyer@example.com",
      },
      fetchImpl
    );
    expect(calls[0].url).toBe("https://usen.test/ec-payment-uhup/i/token/init");
    const body = JSON.parse(calls[0].body);
    const expected = "HM" + createHmac("sha256", key).update("TSJM-0000123,6000").digest("hex");
    expect(body).toMatchObject({
      jutyu_cd: "TSJM-0000123",
      sum_price: 6000,
      check_cd: expected,
      group_id: "TESTGROUP",
      option: "capture",
      expiration_date: "2026/09/28 12:30",
      three_ds_cardholder_info: { email: "buyer@example.com" },
    });
    expect(body.member_id).toBeUndefined();
    expect(body.pay_method).toBeUndefined();
  });
});

describe("usenPay（8.4）", () => {
  it("OnPaymentStart の check_cd をそのまま送る", async () => {
    const { calls, fetchImpl } = recorder('{"result":"ok","code":"01","brand":"VISA"}');
    const res = await usenPay(profile, { jutyuCd: "TSJM-0000123", token: "T", checkCd: "HMabc" }, fetchImpl);
    expect(res.brand).toBe("VISA");
    expect(JSON.parse(calls[0].body)).toEqual({ jutyu_cd: "TSJM-0000123", token: "T", check_cd: "HMabc", group_id: "TESTGROUP" });
  });
});

describe("usenSearchTrade（会員ID決済IF 6.1）", () => {
  it("check_cd=HM+HMAC-MD5(jutyu_cd)・XML を読む", async () => {
    const xml =
      "<response><jutyu_cd>TSJM-0000123</jutyu_cd><result>ok</result><code>01</code><status>sales</status>" +
      "<amount>6000</amount><card_num>411111******1111</card_num></response>";
    const { calls, fetchImpl } = recorder(xml);
    const res = await usenSearchTrade(profile, "TSJM-0000123", fetchImpl);
    expect(calls[0].url).toBe("https://usen.test/payment/search/trade");
    const params = new URLSearchParams(calls[0].body);
    expect(params.get("check_cd")).toBe("HM" + createHmac("md5", key).update("TSJM-0000123").digest("hex"));
    expect(params.get("group_id")).toBe("TESTGROUP");
    expect(res.status).toBe("sales");
  });
});

describe("usenReturn（会員ID決済IF 3.4 即時売上返品）", () => {
  it("/auth/return に check_cd=HM+HMAC-MD5(jutyu_cd,amount)・sales_day・group_id を送る", async () => {
    const { calls, fetchImpl } = recorder("<response><result>ok</result><code>40</code><process_day>2026/10/08</process_day></response>");
    const res = await usenReturn(profile, { jutyuCd: "TSJM-0000064", amount: 3390, salesDay: "2026/10/02" }, fetchImpl);
    expect(calls[0].url).toBe("https://usen.test/payment/auth/return");
    const params = new URLSearchParams(calls[0].body);
    expect(params.get("check_cd")).toBe("HM" + createHmac("md5", key).update("TSJM-0000064,3390").digest("hex"));
    expect(Object.fromEntries(params)).toMatchObject({ jutyu_cd: "TSJM-0000064", amount: "3390", sales_day: "2026/10/02", group_id: "TESTGROUP" });
    expect(res).toMatchObject({ result: "ok", code: "40" });
  });
});

describe("classifyTrade（6.1.5 の status）", () => {
  it("売上済み・売上待ちは captured（金額・下4桁）", () => {
    expect(classifyTrade({ result: "ok", status: "sales", amount: "6000", card_num: "411111******1111" })).toEqual({
      kind: "captured",
      amount: 6000,
      last4: "1111",
      processedAt: undefined,
    });
    expect(classifyTrade({ result: "ok", status: "sales_reserve" }).kind).toBe("captured");
  });

  it("その他の状態", () => {
    expect(classifyTrade({ result: "ok", status: "sales_return_reserve" }).kind).toBe("refunded");
    expect(classifyTrade({ result: "ok", status: "auth" }).kind).toBe("authorized_only");
    expect(classifyTrade({ result: "ok", status: "void" }).kind).toBe("voided");
    expect(classifyTrade({ result: "ok", status: "unprocessed", auth_result: "ng", auth_code: "02" }).kind).toBe("declined");
    expect(classifyTrade({ result: "ok", status: "unprocessed" }).kind).toBe("in_progress");
    expect(classifyTrade({ result: "ng", code: "01" }).kind).toBe("not_found");
    expect(classifyTrade({ result: "ng", code: "05" }).kind).toBe("unknown");
  });
});
