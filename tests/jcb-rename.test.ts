import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

import { detectJcbDataType, parseHeaderLine, readJcbHeaderLine } from "@/lib/csv/jcb-rename";
import { buildCsvFilename } from "@/lib/csv/naming";

async function readJcbHeader(filename: string): Promise<string[]> {
  const buf = await readFile(`test-data/${filename}`);
  const decoded = new TextDecoder("shift-jis").decode(buf.subarray(0, 64 * 1024));
  const firstLine = decoded.split(/\r\n|\n|\r/)[0];
  return parseHeaderLine(firstLine);
}

describe("JCB CSV header detection", () => {
  it("detects UR (売上明細) from ダミー CSV", async () => {
    const cols = await readJcbHeader("JCB_売上明細CSV_ダミー.csv");
    const result = detectJcbDataType(cols);
    expect(result.dataType).toBe("UR");
  });

  it("detects FI (振込情報) from ダミー CSV", async () => {
    const cols = await readJcbHeader("JCB_振込情報CSV_ダミー.csv");
    const result = detectJcbDataType(cols);
    expect(result.dataType).toBe("FI");
  });

  it("detects FM (振込明細) from ダミー CSV", async () => {
    const cols = await readJcbHeader("JCB_振込明細CSV_ダミー.csv");
    const result = detectJcbDataType(cols);
    expect(result.dataType).toBe("FM");
  });

  it("returns null with reason for unknown headers", () => {
    const result = detectJcbDataType(["関係ない列A", "関係ない列B"]);
    expect(result.dataType).toBeNull();
    expect(result.reason).toMatch(/判別不可/);
  });
});

describe("JCB Link 実エクスポート様式の判定", () => {
  // 実JCB Linkの列構成（ダミーと異なる）
  const UR_REAL = "売上年月日,加盟店番号,加盟店名,利用明細書表示名,ブランド区分,ブランド名,支払区分,支払区分名,売上金額,カード番号,売上票照会コード,端末識別番号,承認番号,伝票番号,登録方法,支払先番号,振込年月日,ステータス";
  const FI_REAL = "振込年月日,支払先番号,加盟店契約番号,契約内容,ブランド区分,ブランド名,支払区分,支払区分名,売上件数,売上金額,手数料率,手数料,その他精算,振込金額";
  const FM_REAL = "振込年月日,支払先番号,加盟店契約番号,契約内容,加盟店番号,加盟店名,ブランド区分,ブランド名,支払区分,支払区分名,売上件数,売上金額";
  const MEISAI_REPORT = "加盟店名称,加盟店番号,ご契約カード会社,お支払方法,お取扱カード名,支払区分,売上方法,集計日,売上件数,売上金額（円）";

  it("sales_details(取引明細)を UR と判定", () => {
    expect(detectJcbDataType(parseHeaderLine(UR_REAL)).dataType).toBe("UR");
  });
  it("transfer(振込情報)を FI と判定", () => {
    expect(detectJcbDataType(parseHeaderLine(FI_REAL)).dataType).toBe("FI");
  });
  it("transfer_detail_totalization(集計日なし)を FM と判定", () => {
    expect(detectJcbDataType(parseHeaderLine(FM_REAL)).dataType).toBe("FM");
  });
  it("meisai-report(集計レポート)は判別不可（不要ファイル）", () => {
    expect(detectJcbDataType(parseHeaderLine(MEISAI_REPORT)).dataType).toBeNull();
  });

  it("UTF-8(BOM付き)のヘッダを正しく読む", async () => {
    const csv = "﻿" + UR_REAL + "\r\n2026/06/11,24111748400001\r\n";
    const file = new File([new TextEncoder().encode(csv)], "sales_details.csv");
    const header = await readJcbHeaderLine(file);
    expect(header.startsWith("売上年月日")).toBe(true); // BOMが除去され文字化けしない
    expect(detectJcbDataType(parseHeaderLine(header)).dataType).toBe("UR");
  });
});

describe("JCB 命名規則 JCB_{種別}_{締日}_{支払先番号}.csv", () => {
  const cases = [
    { file: "JCB_売上明細CSV_ダミー.csv", expected: "JCB_UR_20260315_156742401.csv" },
    { file: "JCB_振込情報CSV_ダミー.csv", expected: "JCB_FI_20260315_156742401.csv" },
    { file: "JCB_振込明細CSV_ダミー.csv", expected: "JCB_FM_20260315_156742401.csv" },
  ];

  it.each(cases)(
    "$file → $expected (締日2026-03-15, 支払先156742401)",
    async ({ file, expected }) => {
      const cols = await readJcbHeader(file);
      const result = detectJcbDataType(cols);
      expect(result.dataType).not.toBeNull();
      const filename = buildCsvFilename({
        issuer: "JCB",
        dataType: result.dataType!,
        closingDate: "2026-03-15",
        payeeNumber: "156742401",
      });
      expect(filename).toBe(expected);
    },
  );
});
