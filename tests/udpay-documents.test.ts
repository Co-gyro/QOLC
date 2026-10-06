import { describe, expect, it } from "vitest";
import {
  documentNumber,
  documentSubject,
  formatSlashDate,
  receiptRows,
  taxBreakdown,
} from "@/lib/udpay/documents";
import { computeTotals } from "@/lib/udpay/logic";
import type { UdpayInvoiceLine } from "@/lib/udpay/types";

/** テスト用の明細行 */
function line(unitPrice: number, taxRate = 10, quantity = 1): UdpayInvoiceLine {
  return { id: "t", description: `明細${unitPrice}`, quantity, unitPrice, taxRate };
}

describe("documentNumber / documentSubject / formatSlashDate", () => {
  it("サービス提供月＋顧客の登録順3桁", () => {
    const customers = [{ id: "a" }, { id: "b" }];
    expect(documentNumber({ month: "2026-10", customerId: "b" }, customers)).toBe("202610002");
  });
  it("件名は「サポート料金（N月分）」", () => {
    expect(documentSubject("2026-02")).toBe("サポート料金（2月分）");
  });
  it("日付は YYYY/M/D", () => {
    expect(formatSlashDate("2025-02-28")).toBe("2025/2/28");
  });
});

describe("taxBreakdown", () => {
  it("ランサイド様サンプル請求書と同じ内訳になる（10%対象 99,900 / 9,990）", () => {
    const b = taxBreakdown([line(9_900), line(90_000)]);
    expect(b.r10).toEqual({ base: 99_900, tax: 9_990 });
    expect(b.r8).toEqual({ base: 0, tax: 0 });
    expect(b.r0).toEqual({ base: 0, tax: 0 });
  });
});

describe("receiptRows", () => {
  it("行ごとの税込額の合計が請求合計と一致する（端数は最大行に寄せる）", () => {
    const lines = [line(333), line(333), line(334), line(-5_000), line(9_900)];
    const rows = receiptRows(lines);
    const totals = computeTotals(lines);
    expect(rows.reduce((s, r) => s + r.tax, 0)).toBe(totals.tax);
    expect(rows.reduce((s, r) => s + r.gross, 0)).toBe(totals.total);
    expect(rows[3]).toMatchObject({ net: -5_000, tax: -500, gross: -5_500 });
  });
  it("軽減税率（8%）の行に印を付ける", () => {
    expect(receiptRows([line(1_000, 8)])[0]).toMatchObject({ reduced: true, tax: 80, gross: 1_080 });
  });
});
