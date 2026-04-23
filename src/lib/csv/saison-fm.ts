import Encoding from "encoding-japanese";

import { yyyymmddToSlashed } from "./naming";

export interface SaisonSalesRow {
  締年月日: string;
  加盟店店舗No: string;
  加盟店名: string;
  支払方法: string;
  売上合計: number;
}

export interface FmAggregateRow {
  振込年月日: string;
  支払先番号: string;
  カード会社: "SAISON";
  締日: string;
  加盟店名: string;
  売上件数: number;
  売上金額: number;
  手数料率: number;
  手数料: number;
  振込金額: number;
}

export interface FmPerClosingFile {
  closingYyyymmdd: string;
  rows: FmAggregateRow[];
  totals: {
    件数: number;
    売上金額: number;
    手数料: number;
    振込金額: number;
  };
}

export interface FmAggregateInput {
  transferDate: string;
  payeeNumber: string;
  feeRatePercent: number;
}

const REQUIRED_COLUMNS = ["締年月日", "加盟店店舗No.", "加盟店名", "支払方法", "売上合計"] as const;
const FM_HEADER = [
  "振込年月日",
  "支払先番号",
  "カード会社",
  "締日",
  "加盟店名",
  "売上件数",
  "売上金額",
  "手数料率",
  "手数料",
  "振込金額",
];

export function parseSaisonCsv(text: string): SaisonSalesRow[] {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSVにデータ行がありません。");
  }
  const header = lines[0].split(",").map((c) => c.trim());
  const indexOf = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`必要な列が見つかりません: ${name}`);
    return i;
  };
  for (const required of REQUIRED_COLUMNS) indexOf(required);

  const idxClosing = indexOf("締年月日");
  const idxStoreNo = indexOf("加盟店店舗No.");
  const idxMerchant = indexOf("加盟店名");
  const idxPayment = indexOf("支払方法");
  const idxTotal = indexOf("売上合計");

  const rows: SaisonSalesRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const closing = (cols[idxClosing] ?? "").trim();
    const storeNo = (cols[idxStoreNo] ?? "").trim();
    const merchant = (cols[idxMerchant] ?? "").trim();
    const payment = (cols[idxPayment] ?? "").trim();
    const totalRaw = (cols[idxTotal] ?? "").trim();
    if (!closing && !merchant && !totalRaw) continue;
    const total = Number(totalRaw);
    if (!Number.isFinite(total)) {
      throw new Error(`売上合計を数値に変換できません（${i + 1}行目: "${totalRaw}"）`);
    }
    rows.push({
      締年月日: closing,
      加盟店店舗No: storeNo,
      加盟店名: merchant,
      支払方法: payment,
      売上合計: total,
    });
  }
  return rows;
}

export function aggregateFm(
  rows: SaisonSalesRow[],
  input: FmAggregateInput,
): FmPerClosingFile[] {
  const { transferDate, payeeNumber, feeRatePercent } = input;

  const byClosing = new Map<string, Map<string, { count: number; sum: number }>>();
  for (const r of rows) {
    if (!byClosing.has(r.締年月日)) byClosing.set(r.締年月日, new Map());
    const inner = byClosing.get(r.締年月日)!;
    const current = inner.get(r.加盟店名) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += r.売上合計;
    inner.set(r.加盟店名, current);
  }

  const files: FmPerClosingFile[] = [];
  const closingKeys = Array.from(byClosing.keys()).sort();

  for (const closing of closingKeys) {
    const inner = byClosing.get(closing)!;
    const merchantKeys = Array.from(inner.keys()).sort();
    const rowsOut: FmAggregateRow[] = [];
    let total件数 = 0;
    let total売上 = 0;
    let total手数料 = 0;
    let total振込 = 0;

    for (const merchant of merchantKeys) {
      const { count, sum } = inner.get(merchant)!;
      const fee = computeFee(sum, feeRatePercent);
      const transfer = sum - fee;
      rowsOut.push({
        振込年月日: transferDate,
        支払先番号: payeeNumber,
        カード会社: "SAISON",
        締日: yyyymmddToSlashed(closing),
        加盟店名: merchant,
        売上件数: count,
        売上金額: sum,
        手数料率: feeRatePercent,
        手数料: fee,
        振込金額: transfer,
      });
      total件数 += count;
      total売上 += sum;
      total手数料 += fee;
      total振込 += transfer;
    }

    files.push({
      closingYyyymmdd: closing,
      rows: rowsOut,
      totals: {
        件数: total件数,
        売上金額: total売上,
        手数料: total手数料,
        振込金額: total振込,
      },
    });
  }

  return files;
}

export function computeFee(amount: number, feeRatePercent: number): number {
  const raw = (amount * feeRatePercent) / 100;
  return amount >= 0 ? Math.floor(raw) : -Math.floor(-raw);
}

export function renderFmCsv(file: FmPerClosingFile): string {
  const lines: string[] = [];
  lines.push(FM_HEADER.map(csvField).join(","));
  for (const r of file.rows) {
    lines.push(
      [
        r.振込年月日,
        r.支払先番号,
        r.カード会社,
        r.締日,
        r.加盟店名,
        r.売上件数,
        r.売上金額,
        r.手数料率,
        r.手数料,
        r.振込金額,
      ]
        .map((v) => csvField(String(v)))
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function encodeShiftJis(text: string): Uint8Array<ArrayBuffer> {
  const unicodeArray = Encoding.stringToCode(text);
  const sjisArray = Encoding.convert(unicodeArray, { to: "SJIS", from: "UNICODE" });
  const buffer = new ArrayBuffer(sjisArray.length);
  const view = new Uint8Array(buffer);
  view.set(sjisArray);
  return view;
}

export async function readSaisonCsvText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return new TextDecoder("shift-jis").decode(buffer);
}
