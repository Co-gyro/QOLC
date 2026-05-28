/**
 * トークン式EC決済API（token-ec-api）のテスト
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../../src/lib/payment/audit-log", () => ({
  logPaymentAudit: vi.fn().mockResolvedValue(true),
  maskSensitive: (x: unknown) => x,
}));

import { tokenInit, pay, isTokenOk } from "../../src/lib/payment/token-ec-api";
import { generateCheckCodeWithKey, resetHmacKeyCache } from "../../src/lib/payment/hmac";

const TEST_KEY = Buffer.from(Array.from({ length: 64 }, (_, i) => i));

function makeFetch(json: unknown) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl = (async (input: unknown, init?: { body?: string }) => {
    calls.push({ url: String(input), body: init?.body ? JSON.parse(init.body) : undefined });
    return new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("token-ec-api", () => {
  let mallKeyPath: string;
  let siteKeyPath: string;
  const SITE_KEY = Buffer.from(Array.from({ length: 64 }, (_, i) => 200 - i));
  const ORIG = { ...process.env };

  beforeEach(() => {
    resetHmacKeyCache();
    mallKeyPath = join(tmpdir(), `qolc-tk-mall-${Date.now()}.NMK`);
    siteKeyPath = join(tmpdir(), `qolc-tk-site-${Date.now()}.NMK`);
    writeFileSync(mallKeyPath, TEST_KEY);
    writeFileSync(siteKeyPath, SITE_KEY);
    process.env.USEN_MALL_HMAC_KEY_PATH = mallKeyPath;
    process.env.USEN_SITE_HMAC_KEY_PATH = siteKeyPath;
    process.env.USEN_TOKEN_CHECK_KEY_TYPE = "mall";
    process.env.USEN_TOKEN_EC_API_BASE_URL = "https://test.example/ec-payment-uhup";
    delete process.env.USEN_GROUP_ID; // 既存テストは後方互換モード
  });
  afterEach(() => {
    resetHmacKeyCache();
    try { unlinkSync(mallKeyPath); } catch { /* ignore */ }
    try { unlinkSync(siteKeyPath); } catch { /* ignore */ }
    process.env = { ...ORIG };
  });

  it("tokenInit: /i/token/init を check_cd(HM+SHA256 of jutyu_cd,sum_price) 付きで呼ぶ", async () => {
    const { fetchImpl, calls } = makeFetch({ result: "ok", code: "01", three_ds_required: true, check_cd: "HMnext" });
    const res = await tokenInit(
      {
        jutyu_cd: "TSJM-0000001",
        sum_price: 1,
        jutyu_day: "2026/05/27",
        token: "BASE64TOKEN",
        card_limit_yyyy: "2030",
        card_limit_mm: "12",
        cardholder_name: "TEST CARD",
        member_id: "Mabc",
        three_ds_cardholder_info: { email: "a@b.test" },
      },
      fetchImpl
    );
    expect(calls[0].url).toBe("https://test.example/ec-payment-uhup/i/token/init");
    const body = calls[0].body as Record<string, unknown>;
    expect(body.jutyu_cd).toBe("TSJM-0000001");
    expect(body.sum_price).toBe(1);
    expect(body.token).toBe("BASE64TOKEN");
    expect(body.member_id).toBe("Mabc");
    expect(body.three_ds_cardholder_info).toEqual({ email: "a@b.test" });
    expect(body.check_cd).toBe(generateCheckCodeWithKey("sha256", TEST_KEY, ["TSJM-0000001", 1]));
    expect(res.three_ds_required).toBe(true);
    expect(isTokenOk(res)).toBe(true);
  });

  it("pay: /i/pay を jutyu_cd/token/check_cd で呼ぶ（check_cdは再生成せず透過）", async () => {
    const { fetchImpl, calls } = makeFetch({ result: "ok", code: "01", member_id: "Mabc", brand: "VISA" });
    const res = await pay({ jutyu_cd: "TSJM-0000001", token: "TOK", check_cd: "HMfromListener" }, fetchImpl);
    expect(calls[0].url).toBe("https://test.example/ec-payment-uhup/i/pay");
    const body = calls[0].body as Record<string, unknown>;
    expect(body).toEqual({ jutyu_cd: "TSJM-0000001", token: "TOK", check_cd: "HMfromListener" });
    expect(res.member_id).toBe("Mabc");
  });

  describe("USEN_GROUP_ID 設定時（USEN推奨方式）", () => {
    beforeEach(() => {
      process.env.USEN_GROUP_ID = "GRP-TEST-001";
      process.env.USEN_TOKEN_CHECK_KEY_TYPE = "mall"; // 設定があってもサイト鍵に強制
    });

    it("tokenInit: body に group_id が付与され、check_cd はサイト鍵で生成される", async () => {
      const { fetchImpl, calls } = makeFetch({ result: "ok", code: "01" });
      await tokenInit(
        {
          jutyu_cd: "TSJM-0000001",
          sum_price: 1,
          jutyu_day: "2026/05/28",
          token: "T",
          card_limit_yyyy: "2030",
          card_limit_mm: "12",
          cardholder_name: "TEST",
          three_ds_cardholder_info: { email: "a@b.test" },
        },
        fetchImpl
      );
      const body = calls[0].body as Record<string, unknown>;
      expect(body.group_id).toBe("GRP-TEST-001");
      // モール鍵では一致せず、サイト鍵で一致することを検証
      expect(body.check_cd).toBe(generateCheckCodeWithKey("sha256", SITE_KEY, ["TSJM-0000001", 1]));
      expect(body.check_cd).not.toBe(generateCheckCodeWithKey("sha256", TEST_KEY, ["TSJM-0000001", 1]));
    });

    it("pay: body に group_id が付与される（check_cd は透過）", async () => {
      const { fetchImpl, calls } = makeFetch({ result: "ok", code: "01" });
      await pay({ jutyu_cd: "TSJM-0000001", token: "TOK", check_cd: "HMfromListener" }, fetchImpl);
      const body = calls[0].body as Record<string, unknown>;
      expect(body).toEqual({
        jutyu_cd: "TSJM-0000001",
        token: "TOK",
        check_cd: "HMfromListener",
        group_id: "GRP-TEST-001",
      });
    });
  });
});
