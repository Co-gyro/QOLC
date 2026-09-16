import { describe, it, expect } from "vitest";
import {
  buildSelfishPayload,
  buildSaisonMerchantNumber,
  percentTextToRateText,
  SAISON_DEFAULT_STORE_NO,
  SELFISH_PAYLOAD_SCHEMA,
  type SelfishSource,
} from "@/lib/selfish/build-payload";

const NOW = new Date("2026-09-16T05:00:00.000Z");

/** 全項目が揃った入力 */
function fullSource(): SelfishSource {
  return {
    merchant: {
      id: "11111111-2222-4333-8444-555555555555",
      name: "まるまるクリニック",
      jcbMerchantCodeRecurring: "24111748400001",
      jcbMerchantCodeEc: "24111748400001",
      saisonMerchantCode: "2077994",
    },
    applyPayload: { corpName: "医療法人まるまる会", contactEmail: "contact@example.jp" },
    ud: {
      settlement_rate: "1.9",
      bank_code: "0310",
      branch_code: "102",
      account_type: "ordinary",
      account_number: "1642043",
      account_holder: "ｲﾘﾖｳﾎｳｼﾞﾝ ﾏﾙﾏﾙｶｲ",
      fee_valid_from: "2026-10-01",
    },
    applicationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    now: NOW,
  };
}

describe("percentTextToRateText（浮動小数を経由しない料率変換）", () => {
  it("% 文字列を小数6桁の率へ", () => {
    expect(percentTextToRateText("1.9")).toBe("0.019000");
    expect(percentTextToRateText("3.25")).toBe("0.032500");
    expect(percentTextToRateText("10")).toBe("0.100000");
    expect(percentTextToRateText("0.5")).toBe("0.005000");
  });
  it("数値でなければ throw", () => {
    expect(() => percentTextToRateText("abc")).toThrow();
    expect(() => percentTextToRateText("1.234")).toThrow();
  });
});

describe("buildSelfishPayload（全項目あり）", () => {
  it("qolc.merchant.v1 のペイロードを組み立て ready=true", () => {
    const r = buildSelfishPayload(fullSource());
    expect(r.ready).toBe(true);
    // セゾン店舗No.の答え合わせ warning のみ（error なし）
    expect(r.issues).toEqual([
      expect.objectContaining({ field: "card_numbers.SAISON", level: "warning" }),
    ]);
    expect(r.payload).toEqual({
      schema: SELFISH_PAYLOAD_SCHEMA,
      external_id: "11111111-2222-4333-8444-555555555555",
      merchant: { name: "医療法人まるまる会" },
      store: { name: "まるまるクリニック", email: "contact@example.jp", delivery_channel: "email" },
      account: {
        bank_code: "0310",
        branch_code: "102",
        account_type: "1",
        account_number: "1642043",
        account_name_kana: "ｲﾘﾖｳﾎｳｼﾞﾝ ﾏﾙﾏﾙｶｲ",
      },
      card_numbers: [
        { brand: "JCB", merchant_number: "24111748400001" },
        {
          brand: "SAISON",
          merchant_number: `2077994${SAISON_DEFAULT_STORE_NO}`,
          parts: { merchant_no: "2077994", store_no: SAISON_DEFAULT_STORE_NO },
        },
      ],
      fee: { valid_from: "2026-10-01", merchant_fee_rate: "0.019000" },
      source: {
        qolc_merchant_id: "11111111-2222-4333-8444-555555555555",
        application_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        generated_at: "2026-09-16T05:00:00.000Z",
      },
    });
  });

  it("JCB 2列が同値なら1件、異なれば重複なしで両方送る", () => {
    const same = buildSelfishPayload(fullSource());
    expect(same.payload.card_numbers.filter((c) => c.brand === "JCB")).toHaveLength(1);
    const src = fullSource();
    src.merchant.jcbMerchantCodeEc = "24111748400002";
    const both = buildSelfishPayload(src);
    expect(both.payload.card_numbers.filter((c) => c.brand === "JCB").map((c) => c.merchant_number)).toEqual([
      "24111748400001",
      "24111748400002",
    ]);
  });

  it("当座は account_type=2、法人名が無ければ加盟店名で代用", () => {
    const src = fullSource();
    src.ud.account_type = "checking";
    src.applyPayload.corpName = undefined;
    const r = buildSelfishPayload(src);
    expect(r.payload.account.account_type).toBe("2");
    expect(r.payload.merchant.name).toBe("まるまるクリニック");
  });

  it("セゾンは加盟店No.7桁+店舗No.7桁の連結（店舗No.既定 0000001）", () => {
    expect(buildSaisonMerchantNumber("2077994")).toBe("20779940000001");
    expect(buildSaisonMerchantNumber("2077994", "0000002")).toBe("20779940000002");
  });
});

describe("buildSelfishPayload（不足・不正の検出）", () => {
  it("口座コード・名義・料率・開始日が無ければ error で ready=false", () => {
    const src = fullSource();
    src.ud = {};
    const r = buildSelfishPayload(src);
    expect(r.ready).toBe(false);
    const fields = r.issues.filter((i) => i.level === "error").map((i) => i.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "account.bank_code",
        "account.branch_code",
        "account.account_type",
        "account.account_number",
        "account.account_name_kana",
        "fee.merchant_fee_rate",
        "fee.valid_from",
      ])
    );
    expect(r.issues.filter((i) => i.level === "error").every((i) => i.fix === "ud_input")).toBe(true);
  });

  it("名義に全銀非許容文字があれば違反文字と変換候補を示す", () => {
    const src = fullSource();
    src.ud.account_holder = "イリョウホウジン・マルマルカイ";
    const r = buildSelfishPayload(src);
    const issue = r.issues.find((i) => i.field === "account.account_name_kana");
    expect(issue?.level).toBe("error");
    expect(issue?.message).toContain("変換候補: ｲﾘﾖｳﾎｳｼﾞﾝ ﾏﾙﾏﾙｶｲ");
  });

  it("JCB 14桁・セゾン7桁以外は error、未登録は warning、両方無しは error", () => {
    const src = fullSource();
    src.merchant.jcbMerchantCodeRecurring = "241117484";
    src.merchant.jcbMerchantCodeEc = "241117484";
    src.merchant.saisonMerchantCode = "20779940000001"; // 連結済み14桁を入れてしまった例
    const r = buildSelfishPayload(src);
    expect(r.issues.map((i) => [i.field, i.level])).toEqual(
      expect.arrayContaining([
        ["card_numbers.JCB", "error"],
        ["card_numbers.SAISON", "error"],
        ["card_numbers", "error"],
      ])
    );

    const onlyJcb = fullSource();
    onlyJcb.merchant.saisonMerchantCode = null;
    const r2 = buildSelfishPayload(onlyJcb);
    expect(r2.ready).toBe(true);
    expect(r2.issues).toEqual([
      expect.objectContaining({ field: "card_numbers.SAISON", level: "warning", fix: "card_codes" }),
    ]);
    expect(r2.payload.card_numbers).toEqual([{ brand: "JCB", merchant_number: "24111748400001" }]);
  });

  it("元申請が無い場合は warning を出し、メール欠落は error", () => {
    const src = fullSource();
    src.applicationId = null;
    src.applyPayload = {};
    const r = buildSelfishPayload(src);
    expect(r.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "source.application_id", level: "warning" }),
        expect.objectContaining({ field: "store.email", level: "error", fix: "application" }),
      ])
    );
    expect(r.ready).toBe(false);
  });

  it("口座番号8桁は error（Selfish は7桁まで）", () => {
    const src = fullSource();
    src.ud.account_number = "12345678";
    const r = buildSelfishPayload(src);
    expect(r.issues.find((i) => i.field === "account.account_number")?.level).toBe("error");
  });
});
