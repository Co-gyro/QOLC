/**
 * 利用料請求書兼領収書モデルのテスト。
 * 参考フォルダ「レセプト」内の実サンプル Type B の数値を用いてケース判定を検証する。
 */
import { describe, it, expect } from "vitest";
import {
  buildReceiptModel,
  formatYen,
  formatNumber,
  formatBenefit,
  type ReceiptInput,
} from "../../src/lib/pdf/receipt-model";

const baseProvider = { name: "ヘルパーステーションかしの樹富士見", postalCode: "371-0116", tel: "027-289-0120" };

function kaigoInput(over: Partial<ReceiptInput> = {}): ReceiptInput {
  return {
    category: "kaigo",
    issuedAt: "令和8年6月3日",
    billingMonth: "令和8年5月",
    recipientName: "渡邉 愛",
    userBurden: 15191,
    costTotal: 151904,
    provider: baseProvider,
    ...over,
  };
}

describe("formatters", () => {
  it("formatNumber は3桁区切り・単位なし", () => {
    expect(formatNumber(15191)).toBe("15,191");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1234.99)).toBe("1,234");
  });
  it("formatYen は円表記（¥は使わない）", () => {
    expect(formatYen(151904)).toBe("151,904円");
    expect(formatYen(0)).toBe("0円");
  });
  it("formatBenefit は▲付き", () => {
    expect(formatBenefit(136713)).toBe("▲136,713円");
    expect(formatBenefit(-100)).toBe("▲100円");
  });
});

describe("buildReceiptModel: 介護保険（kaigo）", () => {
  it("費用総額から給付額を導出し3行を構成（サンプル: 151,904-136,713=15,191）", () => {
    const m = buildReceiptModel(kaigoInput());
    expect(m.amountDisplay).toBe("15,191");
    expect(m.itemRows).toHaveLength(3);
    expect(m.itemRows[0]).toMatchObject({ amount: "15,191円", breakdown: null });
    expect(m.itemRows[0].itemName).toContain("保険内サービス");
    expect(m.itemRows[0].itemName).toContain("令和8年5月");
    expect(m.itemRows[1].itemName).toContain("費用総額(保険内)");
    expect(m.itemRows[1].breakdown).toBe("151,904円");
    expect(m.itemRows[2].itemName).toContain("介護保険給付額");
    expect(m.itemRows[2].breakdown).toBe("▲136,713円");
    expect(m.footnote).toBeNull();
    expect(m.tax10.amount).toBe(0);
  });

  it("給付額のみ与えても費用総額を導出（39,645=35,680+3,965）", () => {
    const m = buildReceiptModel(
      kaigoInput({ userBurden: 3965, costTotal: undefined, insuranceBenefit: 35680 })
    );
    expect(m.itemRows[1].breakdown).toBe("39,645円");
    expect(m.itemRows[2].breakdown).toBe("▲35,680円");
  });

  it("費用総額と給付額を両方明示して不一致だと例外（介護は端数なし）", () => {
    expect(() =>
      buildReceiptModel(kaigoInput({ costTotal: 151905, insuranceBenefit: 136713 }))
    ).toThrow(/一致しません/);
  });

  it("費用総額も給付額も無いと例外", () => {
    expect(() =>
      buildReceiptModel(kaigoInput({ costTotal: undefined, insuranceBenefit: undefined }))
    ).toThrow(/費用総額または給付額/);
  });
});

describe("buildReceiptModel: 医療保険（iryou）", () => {
  it("医療ラベル・脚注・費用総額(保険内なし)（338,520-320,520=18,000）", () => {
    const m = buildReceiptModel({
      category: "iryou",
      issuedAt: "令和8年6月3日",
      billingMonth: "令和8年5月",
      recipientName: "神村 英臣",
      userBurden: 18000,
      costTotal: 338520,
      insuranceBenefit: 320520,
      provider: { name: "訪問看護ステーションかしの樹富士見" },
    });
    expect(m.itemRows[1].itemName).toContain("費用総額");
    expect(m.itemRows[1].itemName).not.toContain("保険内");
    expect(m.itemRows[2].itemName).toContain("医療保険給付額");
    expect(m.footnote).toContain("10円未満");
  });

  it("医療は10円未満四捨五入により費用総額が厳密一致しなくても許容", () => {
    const m = buildReceiptModel({
      category: "iryou",
      issuedAt: "令和8年6月3日",
      billingMonth: "令和8年5月",
      recipientName: "神村 英臣",
      userBurden: 18000,
      costTotal: 338520,
      insuranceBenefit: 320521, // 1円ずれ
      provider: { name: "訪問看護ステーション" },
    });
    expect(m.itemRows[2].breakdown).toBe("▲320,521円");
  });
});

describe("buildReceiptModel: 住宅・自費（jihi）", () => {
  it("その他費用1行・給付なし・軽減税率（145,859 / 10%66,235・8%29,624）", () => {
    const m = buildReceiptModel({
      category: "jihi",
      issuedAt: "令和8年6月3日",
      billingMonth: "令和8年5月",
      recipientName: "渡邉 愛",
      userBurden: 145859,
      tax10: { amount: 66235, tax: 6022 },
      tax8: { amount: 29624, tax: 2195 },
      provider: { name: "リハビリホームかしの樹富士見" },
    });
    expect(m.itemRows).toHaveLength(1);
    expect(m.itemRows[0].itemName).toBe("その他費用");
    expect(m.itemRows[0].amount).toBe("145,859円");
    expect(m.tax10).toEqual({ amount: 66235, tax: 6022 });
    expect(m.tax8).toEqual({ amount: 29624, tax: 2195 });
    expect(m.footnote).toBeNull();
  });

  it("自費は費用総額/給付額が無くても例外にならない", () => {
    expect(() =>
      buildReceiptModel({
        category: "jihi",
        issuedAt: "x",
        billingMonth: "y",
        recipientName: "z",
        userBurden: 1000,
        provider: { name: "p" },
      })
    ).not.toThrow();
  });
});

describe("buildReceiptModel: バリデーション", () => {
  it("userBurden が負だと例外", () => {
    expect(() => buildReceiptModel(kaigoInput({ userBurden: -1 }))).toThrow();
  });
});
