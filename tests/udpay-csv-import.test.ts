import { describe, expect, it } from "vitest";
import { convert } from "encoding-japanese";
import {
  buildTemplateCsv,
  matchRowsToCustomers,
  parseUdpayInvoiceCsv,
} from "@/lib/udpay/csv-import";

const CUSTOMERS = [
  { id: "c1", name: "さくら歯科クリニック", email: "sakura@example.com" },
  { id: "c2", name: "みなと歯科医院", email: "minato@example.com" },
  { id: "c3", name: "みなと歯科医院", email: "minato2@example.com" }, // 同名
];

describe("parseUdpayInvoiceCsv", () => {
  it("基本フォーマット（顧客名/摘要/数量/単価）を読める", () => {
    const csv = [
      "顧客名,摘要,数量,単価（税抜）",
      "さくら歯科クリニック,基本サポート料金,1,9900",
      "さくら歯科クリニック,交通費（実費）,1,\"12,340\"",
    ].join("\n");
    const { rows, warnings } = parseUdpayInvoiceCsv(csv);
    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      line: 2,
      name: "さくら歯科クリニック",
      description: "基本サポート料金",
      quantity: 1,
      unitPrice: 9_900,
    });
    // カンマ入り金額も読める
    expect(rows[1].unitPrice).toBe(12_340);
  });

  it("列名の表記ゆれ（医院名/品目/金額）と数量省略を吸収する", () => {
    const csv = ["医院名,品目,金額", "さくら歯科クリニック,労務管理サポート,55000"].join("\n");
    const { rows, warnings } = parseUdpayInvoiceCsv(csv);
    expect(warnings).toEqual([]);
    expect(rows[0]).toMatchObject({ quantity: 1, unitPrice: 55_000 });
  });

  it("Shift-JISのバイナリも自動判定で読める", () => {
    const csv = "顧客名,摘要,単価\nさくら歯科クリニック,基本サポート料金,9900\n";
    const sjis = new Uint8Array(
      convert(Array.from(new TextEncoder().encode(csv)), { to: "SJIS", from: "UTF8" }) as number[],
    );
    const { rows } = parseUdpayInvoiceCsv(sjis);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("さくら歯科クリニック");
  });

  it("不正行は警告してスキップする（摘要なし・単価不正）", () => {
    const csv = [
      "顧客名,摘要,数量,単価",
      "さくら歯科クリニック,,1,9900",
      "さくら歯科クリニック,基本サポート料金,1,不明",
      "さくら歯科クリニック,基本サポート料金,1,9900",
    ].join("\n");
    const { rows, warnings } = parseUdpayInvoiceCsv(csv);
    expect(rows).toHaveLength(1);
    expect(warnings).toHaveLength(2);
  });

  it("必須列が無いヘッダはエラー警告を返す", () => {
    const { rows, warnings } = parseUdpayInvoiceCsv("A,B,C\n1,2,3");
    expect(rows).toEqual([]);
    expect(warnings[0].message).toContain("必須列");
  });
});

describe("matchRowsToCustomers", () => {
  it("メール優先で顧客を特定し、顧客ごとにグループ化する", () => {
    const { rows } = parseUdpayInvoiceCsv(
      [
        "顧客メール,摘要,単価",
        "SAKURA@example.com,基本サポート料金,9900",
        "sakura@example.com,労務管理サポート,55000",
      ].join("\n"),
    );
    const { groups, unmatched } = matchRowsToCustomers(rows, CUSTOMERS);
    expect(unmatched).toEqual([]);
    expect(groups).toHaveLength(1);
    expect(groups[0].customerId).toBe("c1");
    expect(groups[0].lines).toHaveLength(2);
    expect(groups[0].lines[0].taxRate).toBe(10);
  });

  it("顧客名は空白ゆれを吸収して一致する", () => {
    const { rows } = parseUdpayInvoiceCsv(
      "顧客名,摘要,単価\nさくら歯科 クリニック,基本サポート料金,9900",
    );
    const { groups, unmatched } = matchRowsToCustomers(rows, CUSTOMERS);
    expect(unmatched).toEqual([]);
    expect(groups[0].customerId).toBe("c1");
  });

  it("同名顧客が複数いる場合は誤課金防止のため unmatched にする", () => {
    const { rows } = parseUdpayInvoiceCsv(
      "顧客名,摘要,単価\nみなと歯科医院,基本サポート料金,9900",
    );
    const { groups, unmatched } = matchRowsToCustomers(rows, CUSTOMERS);
    expect(groups).toEqual([]);
    expect(unmatched[0].reason).toContain("同名");
  });

  it("未登録の顧客は unmatched になる", () => {
    const { rows } = parseUdpayInvoiceCsv(
      "顧客名,摘要,単価\n存在しない歯科,基本サポート料金,9900",
    );
    const { unmatched } = matchRowsToCustomers(rows, CUSTOMERS);
    expect(unmatched).toHaveLength(1);
  });
});

describe("buildTemplateCsv", () => {
  it("BOM付きUTF-8・顧客ごとのサンプル行を含む", () => {
    const csv = buildTemplateCsv([{ name: "さくら歯科クリニック" }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("顧客名,摘要,数量,単価（税抜）");
    expect(csv).toContain("さくら歯科クリニック,基本サポート料金,1,9900");
  });
});
