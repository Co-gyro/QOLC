/**
 * 決済データ → ReceiptInput ビルダーのテスト。
 */
import { describe, it, expect } from "vitest";
import {
  buildReceiptInputFromPayment,
  formatWarekiMonth,
  formatWarekiDate,
  type PaymentReceiptData,
} from "../../src/lib/pdf/receipt-input-builder";

function baseData(over: Partial<PaymentReceiptData> = {}): PaymentReceiptData {
  return {
    payment: {
      total_amount: 15191,
      captured_at: "2026-06-03T05:00:00.000Z",
      created_at: "2026-06-01T00:00:00.000Z",
    },
    lines: [
      { amount: 151904, self_pay_amount: 15191, service_name: "訪問介護" },
    ],
    resident: { name_last: "渡邉", name_first: "愛" },
    merchant: { name: "ヘルパーステーションかしの樹富士見", address: "群馬県前橋市富士見町原之郷767-1", phone: "027-289-0120" },
    facility: { name: "テスト介護施設", address: "群馬県前橋市昭和町3-30-10" },
    issuedAtIso: "2026-06-03T00:00:00.000Z",
    ...over,
  };
}

describe("和暦フォーマット", () => {
  it("formatWarekiMonth は令和N年M月（2026=令和8年）", () => {
    expect(formatWarekiMonth("2026-05-10T00:00:00Z")).toBe("令和8年5月");
  });
  it("formatWarekiDate は令和N年M月D日", () => {
    expect(formatWarekiDate("2026-06-03T05:00:00Z")).toBe("令和8年6月3日");
  });
});

describe("buildReceiptInputFromPayment: 保険（給付額>0）", () => {
  it("費用総額=明細amount合計、本人請求=self_pay合計、既定kaigo", () => {
    const input = buildReceiptInputFromPayment(baseData());
    expect(input.category).toBe("kaigo");
    expect(input.userBurden).toBe(15191);
    expect(input.costTotal).toBe(151904);
    expect(input.billingMonth).toBe("令和8年6月");
    expect(input.issuedAt).toBe("令和8年6月3日");
    expect(input.payment?.settledAt).toBe("令和8年6月3日");
    expect(input.recipientName).toBe("渡邉 愛");
    expect(input.recipientAddress).toBe("群馬県前橋市昭和町3-30-10");
    expect(input.provider).toMatchObject({
      name: "ヘルパーステーションかしの樹富士見",
      tel: "027-289-0120",
    });
  });

  it("複数明細を合算する", () => {
    const input = buildReceiptInputFromPayment(
      baseData({
        lines: [
          { amount: 100000, self_pay_amount: 10000, service_name: "A" },
          { amount: 51904, self_pay_amount: 5191, service_name: "B" },
        ],
      })
    );
    expect(input.costTotal).toBe(151904);
    expect(input.userBurden).toBe(15191);
  });

  it("category=iryou で上書きできる", () => {
    const input = buildReceiptInputFromPayment(baseData({ category: "iryou" }));
    expect(input.category).toBe("iryou");
    expect(input.costTotal).toBe(151904);
  });
});

describe("buildReceiptInputFromPayment: 自費（給付額=0）", () => {
  it("amount==self_pay は jihi 判定・費用総額は渡さない", () => {
    const input = buildReceiptInputFromPayment(
      baseData({
        lines: [{ amount: 145859, self_pay_amount: 145859, service_name: "その他費用" }],
      })
    );
    expect(input.category).toBe("jihi");
    expect(input.userBurden).toBe(145859);
    expect(input.costTotal).toBeUndefined();
  });
});

describe("buildReceiptInputFromPayment: フォールバック", () => {
  it("明細が空なら payment.total_amount を本人請求に使う", () => {
    const input = buildReceiptInputFromPayment(baseData({ lines: [] }));
    expect(input.userBurden).toBe(15191);
    // 給付額0 → jihi
    expect(input.category).toBe("jihi");
  });

  it("captured_at が無ければ created_at の月を請求年月に、決済日は非表示", () => {
    const input = buildReceiptInputFromPayment(
      baseData({
        payment: { total_amount: 15191, captured_at: null, created_at: "2026-05-20T00:00:00Z" },
      })
    );
    expect(input.billingMonth).toBe("令和8年5月");
    expect(input.payment?.settledAt).toBeUndefined();
  });
});
