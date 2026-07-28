import { describe, expect, it } from "vitest";
import {
  buildInvoiceMail,
  chargeDateFor,
  computeTotals,
  formatYen,
  maskCardNumber,
  previousMonth,
  validateCardNumber,
} from "@/lib/udpay/logic";
import type { UdpayInvoiceLine } from "@/lib/udpay/types";

/** テスト用の明細行を作る */
function line(unitPrice: number, quantity = 1, taxRate = 10): UdpayInvoiceLine {
  return { id: "t", description: "テスト", quantity, unitPrice, taxRate };
}

describe("computeTotals", () => {
  it("税抜小計・消費税（切り捨て）・税込合計を計算する", () => {
    // ランサイド請求書サンプル相当: 9,900 + 169,800 + 55,000 + 157,964 = 392,664
    const totals = computeTotals([
      line(9_900),
      line(169_800),
      line(55_000),
      line(157_964),
    ]);
    expect(totals.subtotal).toBe(392_664);
    expect(totals.tax).toBe(39_266); // 392,664 × 10% = 39,266.4 → 切り捨て
    expect(totals.total).toBe(431_930);
  });

  it("数量を単価に乗じる", () => {
    const totals = computeTotals([line(169_800, 3)]);
    expect(totals.subtotal).toBe(509_400);
    expect(totals.total).toBe(560_340);
  });

  it("明細ゼロ件は全額ゼロ", () => {
    expect(computeTotals([])).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });
});

describe("chargeDateFor", () => {
  it("サービス提供月の翌月のアニバーサリー日を返す", () => {
    expect(chargeDateFor("2026-07", 14)).toBe("2026-08-14");
    expect(chargeDateFor("2026-07", 5)).toBe("2026-08-05");
  });

  it("12月の翌月は翌年1月になる", () => {
    expect(chargeDateFor("2026-12", 15)).toBe("2027-01-15");
  });

  it("月末を超える日は月末にクランプする", () => {
    // 2027年1月分 → 2月課金。2月に31日はないため28日へ
    expect(chargeDateFor("2027-01", 31)).toBe("2027-02-28");
  });
});

describe("previousMonth", () => {
  it("前月を返す（年跨ぎ含む）", () => {
    expect(previousMonth("2026-07")).toBe("2026-06");
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
});

describe("validateCardNumber / maskCardNumber", () => {
  it("Luhn チェックを通る番号を受理する", () => {
    expect(validateCardNumber("4242 4242 4242 4242")).toBe(true);
    expect(validateCardNumber("4242-4242-4242-4242")).toBe(true);
  });

  it("桁数不足・Luhn 不一致・数字以外は拒否する", () => {
    expect(validateCardNumber("1234")).toBe(false);
    expect(validateCardNumber("4242 4242 4242 4241")).toBe(false);
    expect(validateCardNumber("abcd efgh ijkl mnop")).toBe(false);
  });

  it("マスク表示は末尾4桁のみ残す", () => {
    expect(maskCardNumber("4242 4242 4242 4242")).toBe("**** **** **** 4242");
  });
});

describe("buildInvoiceMail", () => {
  it("ランサイド様の現行メール文面に沿った件名・本文を組み立てる", () => {
    const mail = buildInvoiceMail({
      customerName: "さくら歯科クリニック",
      contactName: "田中",
      month: "2026-07",
      total: 197_670,
      chargeDate: "2026-08-14",
      lines: [line(9_900), line(169_800)],
    });
    expect(mail.subject).toContain("2026年7月");
    expect(mail.body).toContain("田中先生");
    expect(mail.body).toContain("¥197,670");
    expect(mail.body).toContain("2026年8月14日に自動決済");
    expect(mail.body).toContain("お振込の必要はございません");
  });
});

describe("formatYen", () => {
  it("3桁区切りの円表記にする", () => {
    expect(formatYen(431_930)).toBe("¥431,930");
  });
});
