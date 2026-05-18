/**
 * レセプトCSVパーサーのテスト
 */
import { describe, it, expect } from "vitest";
import { parseReceiptCsv } from "../../src/lib/receipt/parser";

/** 合成CSVを組み立てるヘルパー */
function buildCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\r\n") + "\r\n";
}

describe("parseReceiptCsv: 基本", () => {
  it("空入力は空の residents を返す", () => {
    const { data, warnings } = parseReceiptCsv("");
    expect(data.residents).toEqual([]);
    expect(warnings).toBeInstanceOf(Array);
  });

  it("コントロール + 入居者 + サービス + サマリーの最小ケース", () => {
    const csv = buildCsv([
      ["1", "1234567890", "11", "202604", "10.21"],
      ["2", "7131-1", "0000001234", "田中太郎"],
      ["2", "7131-2", "111111", "5", "1500"],
      ["2", "7131-2", "112111", "3", "1000"],
      ["2", "7131-10", "3883", "35681", "3964"],
      ["3"],
    ]);
    const { data, warnings } = parseReceiptCsv(csv);
    expect(warnings).toEqual([]);
    expect(data.facilityNumber).toBe("1234567890");
    expect(data.processingMonth).toBe("202604");
    expect(data.regionalUnitPrice).toBe(10.21);
    expect(data.residents).toHaveLength(1);
    const r = data.residents[0];
    expect(r.insuranceNumber).toBe("0000001234");
    expect(r.name).toBe("田中太郎");
    expect(r.services).toHaveLength(2);
    expect(r.totalUnits).toBe(3883);
  });

  it("3,883単位 × 10.21 = 39,645円（端数切捨て）", () => {
    const csv = buildCsv([
      ["1", "1234567890", "11", "202604", "10.21"],
      ["2", "7131-1", "0000005678", "鈴木花子"],
      ["2", "7131-2", "111111", "1", "3883"],
      ["2", "7131-10", "3883", "35681", "3964"],
      ["3"],
    ]);
    const { data } = parseReceiptCsv(csv);
    const r = data.residents[0];
    // 3883 × 10.21 = 39,645.43 → 切捨て 39645
    expect(r.totalAmount).toBe(39645);
  });

  it("複数入居者をパースできる", () => {
    const csv = buildCsv([
      ["1", "9999999999", "11", "202604", "10.0"],
      ["2", "7131-1", "0000000001", "A太郎"],
      ["2", "7131-2", "111111", "1", "100"],
      ["2", "7131-10", "100", "900", "100"],
      ["2", "7131-1", "0000000002", "B次郎"],
      ["2", "7131-2", "112111", "2", "200"],
      ["2", "7131-10", "200", "1800", "200"],
      ["3"],
    ]);
    const { data } = parseReceiptCsv(csv);
    expect(data.residents).toHaveLength(2);
    expect(data.residents[0].name).toBe("A太郎");
    expect(data.residents[1].name).toBe("B次郎");
    expect(data.residents[1].totalAmount).toBe(2000);
  });

  it("施設サマリー (7111) は警告を出さずスキップ", () => {
    const csv = buildCsv([
      ["1", "1234567890", "11", "202604", "10.21"],
      ["2", "7111", "施設サマリー"],
      ["2", "7131-1", "0000001234", "田中太郎"],
      ["2", "7131-2", "111111", "1", "100"],
      ["2", "7131-10", "100", "900", "100"],
      ["3"],
    ]);
    const { warnings } = parseReceiptCsv(csv);
    expect(warnings).toEqual([]);
  });

  it("入居者前のサービス明細は警告を出す", () => {
    const csv = buildCsv([
      ["1", "1234567890", "11", "202604", "10.21"],
      ["2", "7131-2", "111111", "1", "100"], // 入居者なし
      ["3"],
    ]);
    const { warnings } = parseReceiptCsv(csv);
    expect(warnings.some((w) => w.code === "ORPHAN_SERVICE")).toBe(true);
  });

  it("エンドレコードがなくても最後の入居者を flush", () => {
    const csv = buildCsv([
      ["1", "1234567890", "11", "202604", "10.0"],
      ["2", "7131-1", "0000000001", "A太郎"],
      ["2", "7131-10", "100", "900", "100"],
    ]);
    const { data } = parseReceiptCsv(csv);
    expect(data.residents).toHaveLength(1);
  });

  it("サービスコードからサービス名が解決される（デフォルトマスタ）", () => {
    const csv = buildCsv([
      ["1", "1234567890", "11", "202604", "10.0"],
      ["2", "7131-1", "0000000001", "A太郎"],
      ["2", "7131-2", "111111", "1", "100"],
      ["2", "7131-10", "100", "900", "100"],
      ["3"],
    ]);
    const { data } = parseReceiptCsv(csv);
    expect(data.residents[0].services[0].serviceName).toBe("訪問介護・身体介護");
  });

  it("不明なサービスコードは「未登録」表記", () => {
    const csv = buildCsv([
      ["1", "1234567890", "11", "202604", "10.0"],
      ["2", "7131-1", "0000000001", "A太郎"],
      ["2", "7131-2", "999999", "1", "100"],
      ["2", "7131-10", "100", "900", "100"],
      ["3"],
    ]);
    const { data } = parseReceiptCsv(csv);
    expect(data.residents[0].services[0].serviceName).toMatch(/未登録/);
  });
});
