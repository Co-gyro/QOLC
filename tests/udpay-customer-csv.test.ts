import { describe, expect, it } from "vitest";
import { customerCsvTemplate, parseCustomerCsv } from "@/lib/udpay/customer-csv";
import { parseUdpayInvoiceCsv } from "@/lib/udpay/csv-import";

const DAYS = [15, 28];

describe("parseCustomerCsv", () => {
  it("見出しの表記ゆれを吸収し、CC は複数・決済日が空なら標準日", () => {
    const csv = [
      "医院名,担当者,メールアドレス,CC,決済日,郵便番号,住所,住所2,備考",
      "医療法人社団あおば会　あおば歯科,高橋,Info@Aoba.example,keiri@aoba.example;jimu@aoba.example,,150-0001,東京都渋谷区1-2-3,,メモ",
      "みなと歯科,佐藤,minato@example.com,,28日,,,,",
    ].join("\r\n");
    const { rows, warnings } = parseCustomerCsv(csv, DAYS);
    expect(warnings).toEqual([]);
    expect(rows[0]).toMatchObject({
      name: "医療法人社団あおば会　あおば歯科",
      email: "info@aoba.example",
      cc: ["keiri@aoba.example", "jimu@aoba.example"],
      anniversaryDay: 15,
      postalCode: "150-0001",
      note: "メモ",
    });
    expect(rows[1]).toMatchObject({ anniversaryDay: 28 });
  });

  it("メール不正・医院名なし・重複はスキップし、使えない決済日は標準日にして注意を出す", () => {
    const csv = ["医院名,メール,決済日", "A,bad,15", ",x@example.com,15", "B,b@example.com,10", "B,b@example.com,15"].join("\n");
    const { rows, warnings } = parseCustomerCsv(csv, DAYS);
    expect(rows.map((r) => [r.name, r.anniversaryDay])).toEqual([["B", 15]]);
    expect(warnings.map((w) => w.line)).toEqual([2, 3, 4, 5]);
  });

  it("必須列がなければ読まない", () => {
    expect(parseCustomerCsv("担当者,メール\n山田,a@example.com", DAYS).rows).toEqual([]);
  });

  it("ひな形はそのまま読める", () => {
    expect(parseCustomerCsv(customerCsvTemplate(), DAYS).rows).toHaveLength(1);
  });
});

describe("parseUdpayInvoiceCsv（請求CSV）", () => {
  it("マイナス金額（値引き）を読める", () => {
    const { rows, warnings } = parseUdpayInvoiceCsv("顧客名,摘要,単価\nさくら歯科,値引き,-5000\nさくら歯科,調整,▲1000");
    expect(warnings).toEqual([]);
    expect(rows.map((r) => r.unitPrice)).toEqual([-5000, -1000]);
  });
});
