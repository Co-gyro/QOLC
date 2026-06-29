/**
 * その他費用（保険外）CSV パーサー
 *
 * 介護保険レセプトには載らない「その他費用」(家賃/共益費/食事/居住費/日常生活費/
 * おむつ等の自費)を、施設の自費請求データ(請求ソフトの確定額)から最小CSVで取り込む。
 * QOLCは金額を独自計算せず、確定額を直読する(星さん方針)。
 *
 * フォーマット(QOLC独自・最小・ヘッダ行必須):
 *   被保険者番号, その他費用, [10%対象], [8%対象]
 *   例:
 *     被保険者番号,その他費用,10%対象,8%対象
 *     0001325455,145859,66235,29624
 *     0000005678,98000,98000,0
 *
 * - 必須列  : 被保険者番号 / その他費用(合計・税込)
 * - 任意列  : 10%対象 / 8%対象 (税込・インボイス税額表示用。無ければ税内訳なし)
 * - 文字コード: UTF-8 / Shift-JIS(CP932) 両対応(先頭バイトから自動判定)
 * - 列名は表記ゆれを吸収(「介護保険番号」「合計」「その他費用合計」等)
 *
 * どの請求ソフトでも「被保険者番号＋合計」の数値は出せるため、ベンダ非依存で運用できる。
 */
import { convert, detect } from "encoding-japanese";
import Papa from "papaparse";

/** その他費用の1明細(1入居者・1月分の合算) */
export interface OtherCostRow {
  /** 被保険者番号(介護保険・10桁、先頭0保持の文字列) */
  insuranceNumber: string;
  /** その他費用 合計(円・税込)＝決済へ合算する額 */
  total: number;
  /** うち10%対象額(税込)。未指定は null */
  tax10: number | null;
  /** うち8%対象☆額(税込・軽減税率)。未指定は null */
  tax8: number | null;
}

/** パース時の警告(処理は継続する非致命的問題) */
export interface OtherCostWarning {
  line: number;
  code: string;
  message: string;
}

/** パース結果 */
export interface OtherCostParseResult {
  rows: OtherCostRow[];
  warnings: OtherCostWarning[];
}

/** 列名の表記ゆれ吸収(小文字化・空白除去して照合) */
const HEADER_ALIASES: Record<keyof OtherCostRow, string[]> = {
  insuranceNumber: ["被保険者番号", "介護保険番号", "保険者番号", "被保番", "insurancenumber"],
  total: ["その他費用", "その他費用合計", "合計", "金額", "請求額", "total", "amount"],
  tax10: ["10%対象", "10％対象", "10%", "tax10", "10対象"],
  tax8: ["8%対象", "8％対象", "8%対象☆", "8%", "tax8", "8対象", "軽減税率"],
};

/** 正規化(全角％→半角%・空白除去・小文字化) */
function normHeader(s: string): string {
  return s.trim().replace(/％/g, "%").replace(/\s/g, "").toLowerCase();
}

/**
 * その他費用CSVかどうかをヘッダ行から判定する。
 * 「その他費用」列を持つことを必須条件にし、独自CSV(金額/サービス名)やレセプトと区別する。
 * SJIS/UTF-8 を自動判定するため、生バイナリ(Buffer/Uint8Array)を渡してよい。
 * @param input ファイル先頭サンプル(文字列) または 生バイナリ
 */
export function detectOtherCostCsv(input: string | Buffer | Uint8Array): boolean {
  const head = typeof input === "string" ? input : decodeToUtf8(input);
  const firstLine = head.split(/\r?\n/)[0] ?? "";
  if (!firstLine) return false;
  const cols = firstLine.split(",").map(normHeader);
  const totalAliases = HEADER_ALIASES.total.map(normHeader);
  const insAliases = HEADER_ALIASES.insuranceNumber.map(normHeader);
  const hasOtherCost = cols.includes(normHeader("その他費用")) || cols.includes(normHeader("その他費用合計"));
  const hasTotalCol = cols.some((c) => totalAliases.includes(c));
  const hasInsCol = cols.some((c) => insAliases.includes(c));
  // 「その他費用」列を明示的に持つ場合のみ true（合計/金額だけの独自CSVは対象外）
  return hasInsCol && hasTotalCol && hasOtherCost;
}

/**
 * その他費用CSVをパースする。
 * @param input SJIS/UTF-8 バイナリ(Buffer/Uint8Array) または UTF-8 文字列
 */
export function parseOtherCostCsv(
  input: Buffer | Uint8Array | string
): OtherCostParseResult {
  const text = decodeToUtf8(input);
  const warnings: OtherCostWarning[] = [];

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  for (const e of parsed.errors) {
    warnings.push({ line: (e.row ?? 0) + 2, code: e.code ?? "CSV_PARSE", message: e.message });
  }

  // 実ヘッダ名 → フィールドの対応を解決
  const headerKeys = parsed.meta.fields ?? [];
  const colOf = (field: keyof OtherCostRow): string | null => {
    const aliases = HEADER_ALIASES[field].map(normHeader);
    for (const h of headerKeys) {
      if (aliases.includes(normHeader(h))) return h;
    }
    return null;
  };
  const insCol = colOf("insuranceNumber");
  const totalCol = colOf("total");
  const tax10Col = colOf("tax10");
  const tax8Col = colOf("tax8");

  if (!insCol || !totalCol) {
    warnings.push({
      line: 1,
      code: "MISSING_REQUIRED_COLUMN",
      message: "必須列『被保険者番号』『その他費用』が見つかりません",
    });
    return { rows: [], warnings };
  }

  const rows: OtherCostRow[] = [];
  parsed.data.forEach((raw, i) => {
    const insuranceNumber = (raw[insCol] ?? "").trim();
    if (!insuranceNumber) {
      warnings.push({ line: i + 2, code: "MISSING_INSURANCE_NUMBER", message: "被保険者番号が空です" });
      return;
    }
    const total = toIntOrZero(raw[totalCol]);
    if (total <= 0) {
      warnings.push({
        line: i + 2,
        code: "NON_POSITIVE_TOTAL",
        message: `被保険者番号 ${insuranceNumber} のその他費用が 0 以下です`,
      });
      return;
    }
    rows.push({
      insuranceNumber,
      total,
      tax10: tax10Col ? toIntOrNull(raw[tax10Col]) : null,
      tax8: tax8Col ? toIntOrNull(raw[tax8Col]) : null,
    });
  });

  return { rows, warnings };
}

/** 文字列を整数に。不正値は 0 */
function toIntOrZero(v: string | undefined | null): number {
  const n = toIntOrNull(v);
  return n ?? 0;
}

/** 文字列を整数に。空/不正は null */
function toIntOrNull(v: string | undefined | null): number | null {
  const s = (v ?? "").trim().replace(/[,，¥円\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

/** SJIS/UTF-8 バイナリ or 文字列 → UTF-8 文字列 */
function decodeToUtf8(input: Buffer | Uint8Array | string): string {
  if (typeof input === "string") return input;
  const arr = Array.from(input);
  // encoding-japanese で文字コードを推定(UTF8/SJIS/ASCII)。BOM/UTF8 はそのまま、他は SJIS とみなす。
  const detected = detect(arr);
  const from = detected === "UTF8" || detected === "ASCII" ? "UTF8" : "SJIS";
  const converted = convert(arr, { to: "UNICODE", from, type: "string" });
  return typeof converted === "string" ? converted : String(converted);
}
