import type { DataType } from "./naming";

export interface JcbDetectionResult {
  dataType: DataType | null;
  columns: string[];
  columnCount: number;
  reason: string;
}

const HEADER_SCAN_BYTES = 64 * 1024;

/**
 * JCB CSVバッファをデコードする。文字コード自動判別:
 * UTF-8 BOM(EF BB BF)があればUTF-8、無ければShift-JIS（BOMは除去）。
 * 実JCB Linkエクスポートは UTF-8(BOM付き)、ダミーは Shift-JIS。
 */
function decodeJcbBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const decoded = (hasBom ? new TextDecoder("utf-8") : new TextDecoder("shift-jis")).decode(buffer);
  return decoded.replace(/^﻿/, "");
}

export async function readJcbHeaderLine(file: File): Promise<string> {
  const slice = file.slice(0, Math.min(file.size, HEADER_SCAN_BYTES));
  const text = decodeJcbBuffer(await slice.arrayBuffer());
  const newlineIndex = text.search(/\r\n|\n|\r/);
  return newlineIndex === -1 ? text : text.slice(0, newlineIndex);
}

/**
 * 先頭データ行から振込年月日(yyyy/mm/dd)を読み取り、ISO形式(yyyy-mm-dd)で返す。
 * 振込年月日列が無い／データ行が無い場合は null。
 */
export async function readJcbTransferDate(file: File): Promise<string | null> {
  const slice = file.slice(0, Math.min(file.size, HEADER_SCAN_BYTES));
  const lines = decodeJcbBuffer(await slice.arrayBuffer())
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  const idx = parseHeaderLine(lines[0]).indexOf("振込年月日");
  if (idx === -1) return null;
  const raw = (lines[1].split(",")[idx] ?? "").trim();
  const m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
}

export function parseHeaderLine(line: string): string[] {
  return line.split(",").map((c) => c.trim());
}

export function detectJcbDataType(columns: string[]): JcbDetectionResult {
  const set = new Set(columns);
  const has = (name: string) => set.has(name);

  // UR(売上明細): 取引明細レベル。カード番号/利用明細書表示名/承認番号 のいずれか。
  // 実URは加盟店番号+加盟店名+振込年月日も持つため、FM判定より先に評価する。
  if (has("カード番号") || has("利用明細書表示名") || has("承認番号")) {
    return {
      dataType: "UR",
      columns,
      columnCount: columns.length,
      reason: "売上明細(UR): 「カード番号」または「利用明細書表示名」「承認番号」を検出",
    };
  }

  // FI(振込情報): 手数料率・振込金額を持つ振込サマリ。
  if (has("手数料率") && has("振込金額") && has("売上件数")) {
    return {
      dataType: "FI",
      columns,
      columnCount: columns.length,
      reason: "振込情報(FI): 「手数料率」「振込金額」「売上件数」を検出",
    };
  }

  // FM(振込明細): 加盟店別の集計。加盟店番号+加盟店名 と、集計日 or 振込年月日。
  // ダミーは「集計日」あり、実JCB Link(transfer_detail_totalization)は集計日が無く「振込年月日」を持つ。
  if (has("加盟店番号") && has("加盟店名") && (has("集計日") || has("振込年月日"))) {
    return {
      dataType: "FM",
      columns,
      columnCount: columns.length,
      reason: "振込明細(FM): 「加盟店番号」「加盟店名」と「集計日/振込年月日」を検出",
    };
  }

  return {
    dataType: null,
    columns,
    columnCount: columns.length,
    reason: "判別不可: UR/FI/FM いずれの特徴列も見つかりません",
  };
}

export async function detectJcbFromFile(file: File): Promise<JcbDetectionResult> {
  const line = await readJcbHeaderLine(file);
  const columns = parseHeaderLine(line);
  return detectJcbDataType(columns);
}
