import { describe, it, expect } from "vitest";
import { parseOtherCostCsv } from "../../src/lib/receipt/other-cost-csv";

describe("parseOtherCostCsv", () => {
  it("被保険者番号＋その他費用＋税内訳を読む", () => {
    const csv =
      "被保険者番号,その他費用,10%対象,8%対象\r\n" +
      "0001325455,145859,66235,29624\r\n" +
      "0000005678,98000,98000,0\r\n";
    const { rows, warnings } = parseOtherCostCsv(csv);
    expect(warnings).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      insuranceNumber: "0001325455",
      total: 145859,
      tax10: 66235,
      tax8: 29624,
    });
    expect(rows[1]).toEqual({
      insuranceNumber: "0000005678",
      total: 98000,
      tax10: 98000,
      tax8: 0,
    });
  });

  it("先頭0と税内訳なし(合計のみ)を保持する", () => {
    const csv = "被保険者番号,その他費用\n0001325455,50000\n";
    const { rows } = parseOtherCostCsv(csv);
    expect(rows[0]).toEqual({
      insuranceNumber: "0001325455",
      total: 50000,
      tax10: null,
      tax8: null,
    });
  });

  it("列名の表記ゆれ(介護保険番号/合計/全角％)を吸収する", () => {
    const csv = "介護保険番号,合計,10％対象,8％対象\n0001325455,145859,66235,29624\n";
    const { rows } = parseOtherCostCsv(csv);
    expect(rows[0].insuranceNumber).toBe("0001325455");
    expect(rows[0].total).toBe(145859);
    expect(rows[0].tax10).toBe(66235);
    expect(rows[0].tax8).toBe(29624);
  });

  it("カンマ・円記号付き金額を整数化する", () => {
    const csv = "被保険者番号,その他費用\n0001325455,\"145,859円\"\n";
    const { rows } = parseOtherCostCsv(csv);
    expect(rows[0].total).toBe(145859);
  });

  it("必須列が無ければ空＋警告", () => {
    const csv = "氏名,金額の何か\nA,100\n";
    const { rows, warnings } = parseOtherCostCsv(csv);
    expect(rows).toHaveLength(0);
    expect(warnings.some((w) => w.code === "MISSING_REQUIRED_COLUMN")).toBe(true);
  });

  it("被保番空・0以下はスキップして警告", () => {
    const csv = "被保険者番号,その他費用\n,5000\n0001325455,0\n0000009999,1200\n";
    const { rows, warnings } = parseOtherCostCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].insuranceNumber).toBe("0000009999");
    expect(warnings.some((w) => w.code === "MISSING_INSURANCE_NUMBER")).toBe(true);
    expect(warnings.some((w) => w.code === "NON_POSITIVE_TOTAL")).toBe(true);
  });
});
