/**
 * セルフィッシュ取込 共通フォーマット（JCB/SAISON共通）の FI/FM 生成ロジック。
 * 仕様: docs/selfish-common-format-spec.md（確定版 2026-06-23）。
 * 出力は Shift-JIS / CRLF（render側でエンコード）。
 */
import type { SaisonSalesRow } from "./saison-fm";
import type { SaisonPdfData } from "@/lib/pdf/saison-pdf";

/* ───────── 日付ヘルパー ───────── */

interface Ymd {
  y: number;
  m: number;
  d: number;
}

/** "yyyy/mm/dd" / "yyyy/m/d" / "yyyymmdd" を {y,m,d} に正規化。失敗時は null。 */
export function parseYmd(value: string): Ymd | null {
  const s = (value ?? "").trim();
  let m = s.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
  if (!m) m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** 月末日。 */
export function lastDayOfMonth(year: number, month: number): number {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) return 29;
  return days[month - 1];
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmt = (v: Ymd) => `${v.y}/${pad2(v.m)}/${pad2(v.d)}`;

/** 入力日付文字列を "yyyy/mm/dd" に整形（不正なら元のまま）。 */
export function toSlashDate(value: string): string {
  const v = parseYmd(value);
  return v ? fmt(v) : (value ?? "").trim();
}

/**
 * 締日を「売上日」から算出（15日締めサイクル）。
 * 1〜15日 → 当月15日 / 16〜末日 → 当月末日。
 */
export function deriveShimebiFromSaleDate(saleDate: string): string {
  const v = parseYmd(saleDate);
  if (!v) return "";
  const d = v.d <= 15 ? 15 : lastDayOfMonth(v.y, v.m);
  return fmt({ y: v.y, m: v.m, d });
}

/**
 * 締日を「振込日」から逆算（15日締めサイクル）。
 * 振込=当月末日 → 当月15日締 / 振込=15日 → 前月末日締。
 */
export function deriveShimebiFromTransferDate(transferDate: string): string {
  const v = parseYmd(transferDate);
  if (!v) return "";
  if (v.d === lastDayOfMonth(v.y, v.m)) {
    return fmt({ y: v.y, m: v.m, d: 15 }); // 当月末振込 → 当月15日締
  }
  // それ以外（15日振込想定）→ 前月末日締
  const pm = v.m === 1 ? 12 : v.m - 1;
  const py = v.m === 1 ? v.y - 1 : v.y;
  return fmt({ y: py, m: pm, d: lastDayOfMonth(py, pm) });
}

/* ───────── 支払区分 ───────── */

/** SAISONの支払方法名 → JCB支払区分コード（基本合意/変換表）。不明は空。 */
export function saisonPayCode(payMethodName: string): string {
  const n = (payMethodName ?? "").trim();
  if (n === "1回払い") return "10";
  if (n === "ボーナス1回払い" || n === "ボーナス2回払い" || n === "ボーナス払い") return "21";
  if (n === "2回払い") return "69";
  if (n === "分割払い" || n === "分割") return "61";
  if (n === "リボ払い" || n === "リボ") return "80";
  return "";
}

/* ───────── 手数料率 ───────── */

/** 比率(0.0255)を百分率(2.55)に。既に%表記ならそのまま近い値に丸める。 */
export function ratioToPercent(ratio: number): number {
  return Math.round(ratio * 100 * 10000) / 10000;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/* ───────── 行型 ───────── */

export interface CommonFiRow {
  振込年月日: string;
  支払先番号: string;
  カード会社: "JCB" | "SAISON";
  締日: string;
  支払区分: string;
  支払区分名: string;
  売上件数: number;
  売上金額: number;
  手数料率: number;
  手数料: number;
  振込金額: number;
}

export interface CommonFmRow {
  振込年月日: string;
  支払先番号: string;
  カード会社: "JCB" | "SAISON";
  加盟店番号: string;
  加盟店名: string;
  締日: string;
  集計日: string;
  支払区分: string;
  支払区分名: string;
  売上件数: number;
  売上金額: number;
}

/* ───────── JCB 入力行（パース済み） ───────── */

export interface JcbTransferRow {
  振込年月日: string;
  支払先番号: string;
  支払区分: string;
  支払区分名: string;
  売上件数: number;
  売上金額: number;
  手数料率: number; // 比率(0.0255)
  手数料: number;
  振込金額: number;
}

export interface JcbUrRow {
  売上年月日: string;
  加盟店番号: string;
  加盟店名: string;
  支払区分: string;
  支払区分名: string;
  売上金額: number;
  支払先番号: string;
  振込年月日: string;
}

/* ───────── JCB CSV パーサ ───────── */

/** ヘッダ行から列名→indexのマップを作る（BOM除去）。 */
function headerIndex(headerLine: string): Map<string, number> {
  const cols = headerLine.replace(/^﻿/, "").split(",").map((c) => c.trim());
  const m = new Map<string, number>();
  cols.forEach((c, i) => m.set(c, i));
  return m;
}
function splitLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
}
const num = (s: string | undefined) => Number((s ?? "").trim().replace(/,/g, ""));

/** JCB 振込情報CSV(transfer) を JcbTransferRow[] にパース。 */
export function parseJcbTransferCsv(text: string): JcbTransferRow[] {
  const lines = splitLines(text);
  if (lines.length < 2) return [];
  const h = headerIndex(lines[0]);
  const at = (cols: string[], name: string) => (cols[h.get(name) ?? -1] ?? "").trim();
  const rows: JcbTransferRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    rows.push({
      振込年月日: at(c, "振込年月日"),
      支払先番号: at(c, "支払先番号"),
      支払区分: at(c, "支払区分"),
      支払区分名: at(c, "支払区分名"),
      売上件数: num(at(c, "売上件数")),
      売上金額: num(at(c, "売上金額")),
      手数料率: num(at(c, "手数料率")),
      手数料: num(at(c, "手数料")),
      振込金額: num(at(c, "振込金額")),
    });
  }
  return rows;
}

/** JCB 売上明細CSV(sales_details) を JcbUrRow[] にパース。 */
export function parseJcbUrCsv(text: string): JcbUrRow[] {
  const lines = splitLines(text);
  if (lines.length < 2) return [];
  const h = headerIndex(lines[0]);
  const at = (cols: string[], name: string) => (cols[h.get(name) ?? -1] ?? "").trim();
  const rows: JcbUrRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    rows.push({
      売上年月日: at(c, "売上年月日"),
      加盟店番号: at(c, "加盟店番号"),
      加盟店名: at(c, "加盟店名"),
      支払区分: at(c, "支払区分"),
      支払区分名: at(c, "支払区分名"),
      売上金額: num(at(c, "売上金額")),
      支払先番号: at(c, "支払先番号"),
      振込年月日: at(c, "振込年月日"),
    });
  }
  return rows;
}

/* ───────── FI 生成 ───────── */

/** JCB 振込情報(transfer)を共通FIに変換（再集計せずフィールド変換）。 */
export function buildJcbFi(rows: JcbTransferRow[]): CommonFiRow[] {
  return rows.map((r) => ({
    振込年月日: toSlashDate(r.振込年月日),
    支払先番号: r.支払先番号,
    カード会社: "JCB",
    締日: deriveShimebiFromTransferDate(r.振込年月日),
    支払区分: r.支払区分,
    支払区分名: r.支払区分名,
    売上件数: r.売上件数,
    売上金額: r.売上金額,
    手数料率: ratioToPercent(r.手数料率),
    手数料: r.手数料,
    振込金額: r.振込金額,
  }));
}

/** SAISON 売上CSV＋支払計算書PDFを共通FIに変換（支払方法別に集計）。 */
export function buildSaisonFi(
  rows: SaisonSalesRow[],
  pdf: SaisonPdfData,
  payeeNumber: string,
): CommonFiRow[] {
  const totalAmount = pdf.totalAmount;
  const rate = totalAmount > 0 ? round2((pdf.totalFee / totalAmount) * 100) : 0; // %
  const transfer = toSlashDate(pdf.transferDate);

  const byPay = new Map<string, { count: number; sum: number }>();
  for (const r of rows) {
    const cur = byPay.get(r.支払方法) ?? { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += r.売上合計;
    byPay.set(r.支払方法, cur);
  }

  return Array.from(byPay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([pay, agg]) => {
      const fee = Math.round((agg.sum * rate) / 100);
      return {
        振込年月日: transfer,
        支払先番号: payeeNumber,
        カード会社: "SAISON",
        締日: toSlashDate(rows.find((r) => r.支払方法 === pay)?.締年月日 ?? ""),
        支払区分: saisonPayCode(pay),
        支払区分名: pay,
        売上件数: agg.count,
        売上金額: agg.sum,
        手数料率: rate,
        手数料: fee,
        振込金額: agg.sum - fee,
      };
    });
}

/* ───────── FM 生成 ───────── */

/** JCB 売上明細(UR)を共通FMに変換（加盟店番号×支払区分×売上年月日で集計）。 */
export function buildJcbFm(rows: JcbUrRow[]): CommonFmRow[] {
  const groups = new Map<string, { rows: JcbUrRow[]; count: number; sum: number }>();
  for (const r of rows) {
    const key = `${r.加盟店番号}${r.支払区分}${toSlashDate(r.売上年月日)}`;
    const g = groups.get(key) ?? { rows: [], count: 0, sum: 0 };
    g.rows.push(r);
    g.count += 1;
    g.sum += r.売上金額;
    groups.set(key, g);
  }
  return Array.from(groups.values())
    .sort((a, b) => a.rows[0].売上年月日.localeCompare(b.rows[0].売上年月日))
    .map((g) => {
      const r = g.rows[0];
      return {
        振込年月日: toSlashDate(r.振込年月日),
        支払先番号: r.支払先番号,
        カード会社: "JCB",
        加盟店番号: r.加盟店番号,
        加盟店名: r.加盟店名,
        締日: deriveShimebiFromSaleDate(r.売上年月日),
        集計日: toSlashDate(r.売上年月日),
        支払区分: r.支払区分,
        支払区分名: r.支払区分名,
        売上件数: g.count,
        売上金額: g.sum,
      };
    });
}

/** SAISON 売上CSVを共通FMに変換（加盟店×支払方法×受付日で集計）。 */
export function buildSaisonFm(
  rows: SaisonSalesRow[],
  pdf: SaisonPdfData,
  payeeNumber: string,
): CommonFmRow[] {
  const transfer = toSlashDate(pdf.transferDate);
  const groups = new Map<string, { rows: SaisonSalesRow[]; count: number; sum: number }>();
  for (const r of rows) {
    const merchantNo = `${r.加盟店No}${r.加盟店店舗No}`; // 7+7=14桁（加工しない）
    const key = `${merchantNo}${r.支払方法}${r.受付日}`;
    const g = groups.get(key) ?? { rows: [], count: 0, sum: 0 };
    g.rows.push(r);
    g.count += 1;
    g.sum += r.売上合計;
    groups.set(key, g);
  }
  return Array.from(groups.values())
    .sort((a, b) => a.rows[0].受付日.localeCompare(b.rows[0].受付日))
    .map((g) => {
      const r = g.rows[0];
      return {
        振込年月日: transfer,
        支払先番号: payeeNumber,
        カード会社: "SAISON",
        加盟店番号: `${r.加盟店No}${r.加盟店店舗No}`,
        加盟店名: r.加盟店名,
        締日: toSlashDate(r.締年月日),
        集計日: toSlashDate(r.受付日),
        支払区分: saisonPayCode(r.支払方法),
        支払区分名: r.支払方法,
        売上件数: g.count,
        売上金額: g.sum,
      };
    });
}

/* ───────── レンダリング（Shift-JIS化は呼び出し側） ───────── */

const FI_HEADER = [
  "振込年月日", "支払先番号", "カード会社", "締日", "支払区分", "支払区分名",
  "売上件数", "売上金額", "手数料率", "手数料", "振込金額",
];
const FM_HEADER = [
  "振込年月日", "支払先番号", "カード会社", "加盟店番号", "加盟店名", "締日",
  "集計日", "支払区分", "支払区分名", "売上件数", "売上金額",
];

/** 共通FIをCSV文字列(CRLF)に。 */
export function renderCommonFi(rows: CommonFiRow[]): string {
  const lines = [FI_HEADER.join(",")];
  for (const r of rows) {
    lines.push([
      r.振込年月日, r.支払先番号, r.カード会社, r.締日, r.支払区分, r.支払区分名,
      r.売上件数, r.売上金額, r.手数料率, r.手数料, r.振込金額,
    ].join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/** 共通FMをCSV文字列(CRLF)に。 */
export function renderCommonFm(rows: CommonFmRow[]): string {
  const lines = [FM_HEADER.join(",")];
  for (const r of rows) {
    lines.push([
      r.振込年月日, r.支払先番号, r.カード会社, r.加盟店番号, r.加盟店名, r.締日,
      r.集計日, r.支払区分, r.支払区分名, r.売上件数, r.売上金額,
    ].join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
