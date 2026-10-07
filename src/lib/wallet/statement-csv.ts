import { convert, detect } from "encoding-japanese";
import Papa from "papaparse";

/**
 * QOLC Wallet: カード会社（アプラス）の明細 CSV の読み込み。
 *
 * 列（開発指示書 09 の 12.5）: カード番号, 請求月, ご利用日, ご利用店名, ご利用金額, 売上種別,
 *   支払回数, 今回回数, お支払金額, 摘要（現地通貨額など）
 * - カード番号は ≪****-****-****-NNNN≫ の形。下4桁だけを取り出し、残りは捨てる
 * - カード番号と利用日が空の行（手数料など）は利用明細ではない → 参考行
 * - 文字コードは UTF-8（BOM つき）/ Shift-JIS を自動判定
 */

/** 明細の1行（カード番号は下4桁のみ） */
export interface StatementLine {
  lineNo: number;
  cardLast4: string | null;
  targetMonth: string | null;
  usageDate: string | null;
  merchantName: string | null;
  amount: number | null;
  salesType: string | null;
  installmentCount: string | null;
  installmentNo: string | null;
  paymentAmount: number | null;
  note: string | null;
  isReference: boolean;
}

/** 読み込みの結果 */
export interface StatementParseResult {
  lines: StatementLine[];
  targetMonth: string | null;
  errors: string[];
}

/** 上限（CLAUDE.md の CSV アップロード規約） */
export const STATEMENT_MAX_ROWS = 10_000;

const HEADER_ALIASES = {
  card: ["カード番号"],
  targetMonth: ["請求月"],
  usageDate: ["ご利用日", "利用日"],
  merchant: ["ご利用店名", "利用店名", "店名"],
  amount: ["ご利用金額", "利用金額"],
  salesType: ["売上種別"],
  installmentCount: ["支払回数"],
  installmentNo: ["今回回数"],
  paymentAmount: ["お支払金額", "支払金額"],
  note: ["摘要"],
} as const;

type Column = keyof typeof HEADER_ALIASES;

/** 列名の表記ゆれ吸収（NFKC・空白除去） */
function normHeader(s: string): string {
  return s.normalize("NFKC").replace(/\s/g, "");
}

/** バイト列または文字列を UTF-8 文字列にする（BOM は除く） */
export function decodeStatement(input: Uint8Array | string): string {
  if (typeof input === "string") return input.replace(/^﻿/, "");
  const arr = Array.from(input);
  const detected = detect(arr);
  const from = detected === "UTF8" || detected === "ASCII" ? "UTF8" : "SJIS";
  const converted = convert(arr, { to: "UNICODE", from, type: "string" });
  return (typeof converted === "string" ? converted : String(converted)).replace(/^﻿/, "");
}

/** カード番号の欄から下4桁だけを取り出す（それ以外は保持しない） */
export function extractLast4(raw: string): string | null {
  const digits = raw.normalize("NFKC").match(/(\d{4})\D*$/);
  return digits ? digits[1] : null;
}

/** "20260707" / "2026/07/07" → "2026-07-07"。不正なら null */
export function parseUsageDate(raw: string): string | null {
  const s = raw.normalize("NFKC").replace(/[^\d]/g, "");
  if (!/^\d{8}$/.test(s)) return null;
  const [y, m, d] = [s.slice(0, 4), s.slice(4, 6), s.slice(6, 8)];
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCMonth() + 1 !== Number(m)) return null;
  return `${y}-${m}-${d}`;
}

/** 金額（カンマ・円記号・全角を吸収。マイナスも受け付ける）。不正は null */
export function parseYen(raw: string): number | null {
  const s = raw.normalize("NFKC").replace(/[,¥円\s]/g, "");
  return /^-?\d+$/.test(s) ? Number(s) : null;
}

/** 半角カナなどを全角にそろえる（NFKC）。空は null */
function text(raw: string | undefined): string | null {
  const s = (raw ?? "").normalize("NFKC").trim();
  return s === "" ? null : s;
}

/** 明細 CSV を読み込む */
export function parseStatementCsv(input: Uint8Array | string): StatementParseResult {
  const parsed = Papa.parse<string[]>(decodeStatement(input), { skipEmptyLines: true });
  const rows = parsed.data;
  if (rows.length === 0) return { lines: [], targetMonth: null, errors: ["CSV が空です"] };
  if (rows.length - 1 > STATEMENT_MAX_ROWS) {
    return { lines: [], targetMonth: null, errors: [`行数が上限（${STATEMENT_MAX_ROWS}行）を超えています`] };
  }

  const header = rows[0].map(normHeader);
  const index = {} as Record<Column, number>;
  for (const key of Object.keys(HEADER_ALIASES) as Column[]) {
    index[key] = header.findIndex((h) => HEADER_ALIASES[key].some((alias) => h.startsWith(normHeader(alias))));
  }
  const missing = (["card", "usageDate", "amount"] as Column[]).filter((k) => index[k] < 0);
  if (missing.length > 0) {
    return { lines: [], targetMonth: null, errors: [`必要な列がありません: ${missing.map((k) => HEADER_ALIASES[k][0]).join("、")}`] };
  }

  const cell = (row: string[], key: Column) => (index[key] >= 0 ? row[index[key]] ?? "" : "");
  const lines: StatementLine[] = rows.slice(1).map((row, i) => {
    const cardLast4 = extractLast4(cell(row, "card"));
    const usageDate = parseUsageDate(cell(row, "usageDate"));
    return {
      lineNo: i + 2,
      cardLast4,
      targetMonth: text(cell(row, "targetMonth"))?.replace(/\D/g, "").slice(0, 6) ?? null,
      usageDate,
      merchantName: text(cell(row, "merchant")),
      amount: parseYen(cell(row, "amount")),
      salesType: text(cell(row, "salesType")),
      installmentCount: text(cell(row, "installmentCount")),
      installmentNo: text(cell(row, "installmentNo")),
      paymentAmount: parseYen(cell(row, "paymentAmount")),
      note: text(cell(row, "note")),
      isReference: cardLast4 === null && usageDate === null,
    };
  });
  const targetMonth = lines.find((l) => l.targetMonth)?.targetMonth ?? null;
  return { lines, targetMonth, errors: [] };
}
