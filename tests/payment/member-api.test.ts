/**
 * 会員ID決済API クライアント（member-api）の単体テスト
 *
 * - fetch をモックして、正しいパス・パラメータ・check_cd 付与を検証
 * - XML レスポンスの ok/ng ハンドリングを検証
 * - audit-log はモック（getSupabaseAdminClient のネットワーク呼び出しを回避）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../../src/lib/payment/audit-log", () => ({
  logPaymentAudit: vi.fn().mockResolvedValue(true),
  maskSensitive: (x: unknown) => x,
}));

import {
  authByMemberId,
  salesAdd,
  authVoid,
  memberEntryByJutyuCd,
  searchTrade,
  formatUsenDate,
} from "../../src/lib/payment/member-api";
import { resetHmacKeyCache } from "../../src/lib/payment/hmac";
import { UsenApiError } from "../../src/lib/payment/errors";

const TEST_KEY = Buffer.from(Array.from({ length: 64 }, (_, i) => i));

/** 直近の fetch 呼び出しを記録するモック生成 */
function makeFetch(xml: string) {
  const calls: { url: string; body: string }[] = [];
  const fetchImpl = (async (input: unknown, init?: { body?: unknown }) => {
    calls.push({ url: String(input), body: String(init?.body ?? "") });
    return new Response(xml, { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function parseBody(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of body.split("&")) {
    const [k, v] = pair.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

describe("member-api", () => {
  let siteKeyPath: string;
  let mallKeyPath: string;
  const ORIG = { ...process.env };

  beforeEach(() => {
    resetHmacKeyCache();
    siteKeyPath = join(tmpdir(), `qolc-m-site-${Date.now()}.NMK`);
    mallKeyPath = join(tmpdir(), `qolc-m-mall-${Date.now()}.NMK`);
    writeFileSync(siteKeyPath, TEST_KEY);
    writeFileSync(mallKeyPath, Buffer.from(Array.from({ length: 64 }, (_, i) => 63 - i)));
    process.env.USEN_SITE_HMAC_KEY_PATH = siteKeyPath;
    process.env.USEN_MALL_HMAC_KEY_PATH = mallKeyPath;
    process.env.USEN_SITE_CD = "TSJL";
    process.env.USEN_MEMBER_API_BASE_URL = "https://test.example/payment";
  });

  afterEach(() => {
    resetHmacKeyCache();
    for (const p of [siteKeyPath, mallKeyPath]) {
      try { unlinkSync(p); } catch { /* ignore */ }
    }
    process.env = { ...ORIG };
  });

  describe("authByMemberId", () => {
    const okXml = `<response><jutyu_cd>TSJM-0000001</jutyu_cd><result>ok</result><code>01</code><ucorp>VISA</ucorp></response>`;

    it("正しいパス・パラメータ・check_cd で呼び出す", async () => {
      const { fetchImpl, calls } = makeFetch(okXml);
      const res = await authByMemberId(
        { jutyuCd: "TSJM-0000001", amount: 10500, memberId: "M123", jutyuDay: "2026/05/27" },
        { fetchImpl }
      );
      expect(calls[0].url).toBe("https://test.example/payment/member/authbymemberid");
      const body = parseBody(calls[0].body);
      expect(body.jutyu_cd).toBe("TSJM-0000001");
      expect(body.amount).toBe("10500");
      expect(body.site_cd).toBe("TSJL");
      expect(body.member_id).toBe("M123");
      expect(body.jutyu_day).toBe("2026/05/27");
      expect(body.check_cd).toMatch(/^HM[0-9a-f]{32}$/); // MD5
      expect(res.result).toBe("ok");
      expect(res.ucorp).toBe("VISA");
    });

    it("result=ng で UsenApiError をスロー", async () => {
      const ngXml = `<response><jutyu_cd>TSJM-0000001</jutyu_cd><result>ng</result><code>91</code></response>`;
      const { fetchImpl } = makeFetch(ngXml);
      await expect(
        authByMemberId({ jutyuCd: "TSJM-0000001", amount: 100, memberId: "M1" }, { fetchImpl })
      ).rejects.toThrow(UsenApiError);
    });

    it("jutyu_day 未指定なら本日を補完", async () => {
      const { fetchImpl, calls } = makeFetch(okXml);
      await authByMemberId({ jutyuCd: "TSJM-0000001", amount: 100, memberId: "M1" }, { fetchImpl });
      expect(parseBody(calls[0].body).jutyu_day).toBe(formatUsenDate());
    });
  });

  describe("salesAdd", () => {
    it("/sales/salesadd を sales_day 付きで呼ぶ", async () => {
      const okXml = `<response><result>ok</result><code>40</code></response>`;
      const { fetchImpl, calls } = makeFetch(okXml);
      await salesAdd({ jutyuCd: "TSJM-0000001", amount: 10500, salesDay: "2026/05/27" }, { fetchImpl });
      expect(calls[0].url).toBe("https://test.example/payment/sales/salesadd");
      const body = parseBody(calls[0].body);
      expect(body.sales_day).toBe("2026/05/27");
      expect(body.check_cd).toMatch(/^HM[0-9a-f]{32}$/);
    });

    it("result=ng で UsenApiError", async () => {
      const { fetchImpl } = makeFetch(`<response><result>ng</result><code>41</code></response>`);
      await expect(
        salesAdd({ jutyuCd: "TSJM-0000001", amount: 100 }, { fetchImpl })
      ).rejects.toThrow(UsenApiError);
    });
  });

  describe("authVoid", () => {
    it("/auth/void を jutyu_day 付きで呼ぶ（ng でも例外を投げない）", async () => {
      const { fetchImpl, calls } = makeFetch(`<response><result>ng</result><code>50</code></response>`);
      const res = await authVoid({ jutyuCd: "TSJM-0000001", amount: 100 }, { fetchImpl });
      expect(calls[0].url).toBe("https://test.example/payment/auth/void");
      expect(parseBody(calls[0].body).jutyu_day).toBe(formatUsenDate());
      expect(res.result).toBe("ng"); // void は ok/ng を呼び出し側で判断
    });
  });

  describe("memberEntryByJutyuCd（サイト鍵）", () => {
    it("/member/entrybyjutyucd を site_cd/member_id 署名で呼ぶ", async () => {
      const okXml = `<response><site_cd>TSJL</site_cd><member_id>M1</member_id><result>ok</result></response>`;
      const { fetchImpl, calls } = makeFetch(okXml);
      await memberEntryByJutyuCd({ memberId: "M1", jutyuCd: "TSJL-0000001" }, { fetchImpl });
      expect(calls[0].url).toBe("https://test.example/payment/member/entrybyjutyucd");
      const body = parseBody(calls[0].body);
      expect(body.site_cd).toBe("TSJL");
      expect(body.member_id).toBe("M1");
      expect(body.jutyu_cd).toBe("TSJL-0000001");
      expect(body.check_cd).toMatch(/^HM[0-9a-f]{32}$/);
    });
  });

  describe("searchTrade", () => {
    it("/search/trade を jutyu_cd 単一署名で呼ぶ", async () => {
      const { fetchImpl, calls } = makeFetch(`<response><result>ok</result><status>captured</status></response>`);
      const res = await searchTrade({ jutyuCd: "TSJM-0000001" }, { fetchImpl });
      expect(calls[0].url).toBe("https://test.example/payment/search/trade");
      expect(parseBody(calls[0].body).jutyu_cd).toBe("TSJM-0000001");
      expect(res.result).toBe("ok");
    });
  });
});

describe("formatUsenDate", () => {
  it("yyyy/mm/dd 形式（ゼロ埋め）", () => {
    expect(formatUsenDate(new Date(2026, 0, 5))).toBe("2026/01/05");
    expect(formatUsenDate(new Date(2026, 11, 31))).toBe("2026/12/31");
  });
});
