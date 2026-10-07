import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convert } from "encoding-japanese";
import { extractLast4, parseStatementCsv, parseUsageDate, parseYen } from "@/lib/wallet/statement-csv";

const sample = new Uint8Array(readFileSync("test-data/wallet-statement-sample.csv"));

describe("parseStatementCsv", () => {
  it("UTF-8 BOM のサンプルを読み、下4桁だけを取り出す", () => {
    const r = parseStatementCsv(sample);
    expect(r.errors).toEqual([]);
    expect(r.targetMonth).toBe("202610");
    expect(r.lines).toHaveLength(5);
    expect(r.lines[0]).toMatchObject({
      lineNo: 2, cardLast4: "7152", usageDate: "2026-10-13", amount: 129, salesType: "S", isReference: false,
    });
    expect(JSON.stringify(r.lines)).not.toContain("****");
  });

  it("半角カナの店名を全角にそろえる", () => {
    expect(parseStatementCsv(sample).lines[2].merchantName).toBe("スーパーマルヤマ");
  });

  it("分割払いはご利用金額を金額とし、お支払金額は別に持つ", () => {
    const line = parseStatementCsv(sample).lines[3];
    expect(line).toMatchObject({ cardLast4: "6963", amount: 10000, paymentAmount: 3334, installmentCount: "3" });
  });

  it("カード番号と利用日が空の行は参考行（手数料など）", () => {
    const fee = parseStatementCsv(sample).lines[4];
    expect(fee).toMatchObject({ isReference: true, cardLast4: null, usageDate: null, merchantName: "手数料" });
  });

  it("Shift-JIS でも読める", () => {
    const text = readFileSync("test-data/wallet-statement-sample.csv", "utf8").replace(/^﻿/, "");
    const sjis = new Uint8Array(convert(Array.from(Buffer.from(text, "utf8")), { to: "SJIS", from: "UTF8" }));
    expect(parseStatementCsv(sjis).lines[0].cardLast4).toBe("7152");
  });

  it("必要な列が無ければエラー、空なら空のエラー", () => {
    expect(parseStatementCsv("店名,金額\nA,1").errors[0]).toContain("必要な列がありません");
    expect(parseStatementCsv("").errors).toEqual(["CSV が空です"]);
  });

  it("行数の上限を超えたらエラー", () => {
    const body = "カード番号,ご利用日,ご利用金額\n" + "≪****-****-****-1111≫,20261013,1\n".repeat(10_001);
    expect(parseStatementCsv(body).errors[0]).toContain("上限");
  });
});

describe("値の読み取り", () => {
  it("下4桁", () => {
    expect(extractLast4("≪****-****-****-7152≫")).toBe("7152");
    expect(extractLast4("")).toBeNull();
  });
  it("利用日", () => {
    expect(parseUsageDate("20260707")).toBe("2026-07-07");
    expect(parseUsageDate("2026/07/07")).toBe("2026-07-07");
    expect(parseUsageDate("20260231")).toBeNull();
    expect(parseUsageDate("")).toBeNull();
  });
  it("金額", () => {
    expect(parseYen("１０，０００")).toBe(10000);
    expect(parseYen("-500")).toBe(-500);
    expect(parseYen("abc")).toBeNull();
  });
});
