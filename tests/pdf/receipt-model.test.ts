/**
 * 利用料請求書兼領収書モデルのテスト。
 * 参考フォルダ「レセプト」内の実サンプル Type B の数値を用いてケース判定を検証する。
 */
import { describe, it, expect } from "vitest";
import {
  buildReceiptModel,
  allocateByWeights,
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

describe("buildReceiptModel: カード決済表記", () => {
  it("既定でクレジットカード決済の文言を出し、印紙注記は出さない", () => {
    const m = buildReceiptModel(kaigoInput());
    expect(m.receivedStatement).toBe("上記金額をクレジットカードにて領収いたしました");
    expect(m.paymentLine).toBe("お支払方法：クレジットカード");
    expect(m.stampDutyNote).toBeNull();
    expect(m.invoiceRegistrationNumber).toBeNull();
  });

  it("ブランド・決済日を指定すると支払方法行に反映", () => {
    const m = buildReceiptModel(
      kaigoInput({ payment: { brand: "VISA", settledAt: "令和8年6月3日" } })
    );
    expect(m.paymentLine).toBe("お支払方法：クレジットカード（VISA）　決済日：令和8年6月3日");
  });

  it("showStampDutyNote=true で明示した時のみ印紙注記を出す", () => {
    const m = buildReceiptModel(kaigoInput({ payment: { showStampDutyNote: true } }));
    expect(m.stampDutyNote).toContain("収入印紙は不要");
  });

  it("インボイス登録番号を指定すると保持する", () => {
    const m = buildReceiptModel(
      kaigoInput({ invoiceRegistrationNumber: "T1234567890123" })
    );
    expect(m.invoiceRegistrationNumber).toBe("T1234567890123");
  });

  it("既定でUDの集金代行（代理受領）をラベル形式で明記する", () => {
    const m = buildReceiptModel(kaigoInput());
    expect(m.agentLine).toBe("集金代行（代理受領）：ユニバーサルデベロップメント株式会社（QOLC）");
  });

  it("collectionAgent=null で代理受領表記を抑止", () => {
    const m = buildReceiptModel(kaigoInput({ collectionAgent: null }));
    expect(m.agentLine).toBeNull();
  });

  it("collectionAgent を文字列で上書きできる", () => {
    const m = buildReceiptModel(kaigoInput({ collectionAgent: "テスト代行株式会社" }));
    expect(m.agentLine).toContain("テスト代行株式会社");
  });
});

describe("buildReceiptModel: サービス利用明細書（円ベース・A案）", () => {
  it("明細が無ければ detail は null", () => {
    expect(buildReceiptModel(kaigoInput()).detail).toBeNull();
  });

  it("保険系は内容/金額/自己負担額の列＋合計行", () => {
    const m = buildReceiptModel(
      kaigoInput({
        detailLines: [
          { content: "訪問介護", amount: 100000, selfPay: 10000 },
          { content: "訪問看護", amount: 51904, selfPay: 5191 },
        ],
      })
    );
    expect(m.detail!.columns).toEqual(["内容", "金額", "自己負担額"]);
    expect(m.detail!.rows).toHaveLength(2);
    expect(m.detail!.rows[0]).toEqual(["訪問介護", "100,000円", "10,000円"]);
    expect(m.detail!.totalRow).toEqual(["合計", "151,904円", "15,191円"]);
  });

  it("自費（金額=自己負担）は自己負担列を出さない、数量>1で数量列を出す", () => {
    const m = buildReceiptModel(
      kaigoInput({
        detailLines: [{ content: "その他費用", amount: 5000, selfPay: 5000, quantity: 3 }],
      })
    );
    expect(m.detail!.columns).toEqual(["内容", "数量", "金額"]);
    expect(m.detail!.rows[0]).toEqual(["その他費用", "3", "5,000円"]);
  });

  it("内容が空ならフォールバック表記", () => {
    const m = buildReceiptModel(kaigoInput({ detailLines: [{ content: "", amount: 100 }] }));
    expect(m.detail!.rows[0][0]).toBe("サービス利用");
  });
});

describe("allocateByWeights（金額の項目配分）", () => {
  it("重み比で配分し合計は厳密一致", () => {
    expect(allocateByWeights(1000, [60, 40])).toEqual([600, 400]);
  });
  it("端数は最大剰余で配分（合計一致）", () => {
    const r = allocateByWeights(100, [1, 1, 1]);
    expect(r.reduce((s, v) => s + v, 0)).toBe(100);
    expect(r).toEqual([34, 33, 33]);
  });
  it("負の重み（減算行）でも合計一致", () => {
    const r = allocateByWeights(151904, [370, 3104, -777]);
    expect(r.reduce((s, v) => s + v, 0)).toBe(151904);
  });
  it("重み合計0は先頭に全額", () => {
    expect(allocateByWeights(500, [0, 0])).toEqual([500, 0]);
  });
});

describe("buildReceiptModel: サービス利用明細書（B案・項目別フル/横向き）", () => {
  it("保険系+単位明細は 内容/単位数/回数/費用総額/給付額/自己負担額 を項目別に配分", () => {
    const m = buildReceiptModel(
      kaigoInput({
        userBurden: 100,
        costTotal: 1000,
        detailLines: [
          { content: "通所介護Ⅰ１１", unitScore: 370, count: 1, totalUnits: 60 },
          { content: "通所介護Ⅰ２１", unitScore: 388, count: 8, totalUnits: 40 },
        ],
      })
    );
    const d = m.detail!;
    expect(d.columns).toEqual(["内容", "単位数", "回数", "費用総額", "保険給付額", "自己負担額"]);
    expect(d.landscape).toBe(true);
    expect(d.note).toContain("按分");
    // 配分: 費用 600/400, 自己負担 60/40, 給付=費用-自己負担 540/360
    expect(d.rows[0]).toEqual(["通所介護Ⅰ１１", "370", "1", "600円", "540円", "60円"]);
    expect(d.rows[1]).toEqual(["通所介護Ⅰ２１", "388", "8", "400円", "360円", "40円"]);
    // 合計は確定額に一致（自己負担合計=領収額）
    expect(d.totalRow).toEqual(["合計", "", "", "1,000円", "900円", "100円"]);
  });

  it("各金額列の行合計は確定額（領収額）に厳密一致する", () => {
    const m = buildReceiptModel(
      kaigoInput({
        userBurden: 17464,
        costTotal: 174631,
        detailLines: [
          { content: "A", unitScore: 370, count: 1, totalUnits: 370 },
          { content: "B", unitScore: 388, count: 8, totalUnits: 3104 },
          { content: "C", unitScore: 658, count: 17, totalUnits: 11186 },
          { content: "減算", unitScore: 0, count: 1, totalUnits: -156 },
        ],
      })
    );
    const yen = (s: string) => Number(s.replace(/[円,]/g, ""));
    const d = m.detail!;
    const sumCost = d.rows.reduce((s, r) => s + yen(r[3]), 0);
    const sumSelf = d.rows.reduce((s, r) => s + yen(r[5]), 0);
    expect(sumCost).toBe(174631);
    expect(sumSelf).toBe(17464); // = 領収額
  });

  it("医療(費用amount・単位数なし)は 内容/回数/費用総額/給付額/自己負担額（単位数列なし）", () => {
    const m = buildReceiptModel({
      category: "iryou",
      issuedAt: "x",
      billingMonth: "令和8年4月",
      recipientName: "患者",
      userBurden: 100,
      costTotal: 1000,
      provider: { name: "訪問看護ST" },
      detailLines: [
        { content: "訪問看護基本療養費", count: 10, amount: 600 },
        { content: "訪問看護管理療養費", count: 1, amount: 400 },
      ],
    });
    const d = m.detail!;
    expect(d.columns).toEqual(["内容", "回数", "費用総額", "保険給付額", "自己負担額"]);
    expect(d.landscape).toBe(true);
    expect(d.note).toContain("10円未満");
    // 費用は実額、自己負担は費用比配分(60/40)、給付=費用-自己負担
    expect(d.rows[0]).toEqual(["訪問看護基本療養費", "10", "600円", "540円", "60円"]);
    expect(d.rows[1]).toEqual(["訪問看護管理療養費", "1", "400円", "360円", "40円"]);
    expect(d.totalRow).toEqual(["合計", "", "1,000円", "900円", "100円"]);
  });

  it("総額が無い単位明細（自費等）は 内容/単位数/回数/合計単位数 にフォールバック", () => {
    const m = buildReceiptModel({
      category: "jihi",
      issuedAt: "x",
      billingMonth: "y",
      recipientName: "z",
      userBurden: 1000,
      provider: { name: "p" },
      detailLines: [{ content: "サービス", unitScore: 50, count: 2, totalUnits: 100 }],
    });
    expect(m.detail!.columns).toEqual(["内容", "単位数", "回数", "合計単位数"]);
    expect(m.detail!.landscape).toBe(false);
  });
});

describe("buildReceiptModel: バリデーション", () => {
  it("userBurden が負だと例外", () => {
    expect(() => buildReceiptModel(kaigoInput({ userBurden: -1 }))).toThrow();
  });
});
