import type { UdpayCustomer, UdpayInvoice, UdpayInvoiceLine } from "./types";
import { formatMonthJa } from "./logic";

/**
 * 請求書・領収証（ランサイド様指定フォーマット 2026-10-01 受領）の帳票データを組み立てる純粋ロジック。
 * 画面（印刷）と将来の PDF 生成で共通に使う。
 */

/** 税率別の内訳（税抜金額・消費税額） */
export interface TaxBucket {
  base: number;
  tax: number;
}

/** 税率別内訳（10%・軽減8%・0%） */
export interface TaxBreakdown {
  r10: TaxBucket;
  r8: TaxBucket;
  r0: TaxBucket;
}

/** 領収証の明細行（税抜・消費税・税込） */
export interface ReceiptRow {
  description: string;
  /** 軽減税率対象か（8%） */
  reduced: boolean;
  net: number;
  tax: number;
  gross: number;
}

/**
 * 帳票番号（請求№）。サービス提供月＋顧客の登録順3桁（例: 202610001）。
 * 同じ顧客・同じ月の請求は1件のため一意になる。領収証も同じ番号を使う。
 */
export function documentNumber(
  invoice: Pick<UdpayInvoice, "month" | "customerId">,
  customers: Pick<UdpayCustomer, "id">[],
): string {
  const index = Math.max(customers.findIndex((c) => c.id === invoice.customerId), 0);
  return `${invoice.month.replace("-", "")}${String(index + 1).padStart(3, "0")}`;
}

/** 帳票の件名（例: サポート料金（10月分）） */
export function documentSubject(month: string): string {
  return `サポート料金（${Number(month.slice(5, 7))}月分）`;
}

/** 件名の長い表記（メール等で使う。例: 2026年10月サービス分） */
export function documentSubjectLong(month: string): string {
  return `${formatMonthJa(month)}サービス分`;
}

/** 税率別内訳を作る（消費税は税率ごとに小計へ乗じて切り捨て＝computeTotals と同じ） */
export function taxBreakdown(lines: UdpayInvoiceLine[]): TaxBreakdown {
  const bucket = (rate: number): TaxBucket => {
    const target = lines.filter((l) => l.taxRate === rate);
    const base = target.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    return { base, tax: Math.floor((base * rate) / 100) };
  };
  return { r10: bucket(10), r8: bucket(8), r0: bucket(0) };
}

/**
 * 領収証の明細行を作る。行ごとの消費税は切り捨てで出し、
 * 税率ごとの端数差は金額が最も大きい行に寄せて、合計を請求書（logic.computeTotals）と一致させる。
 */
export function receiptRows(lines: UdpayInvoiceLine[]): ReceiptRow[] {
  const rows = lines.map((l) => {
    const net = l.unitPrice * l.quantity;
    const tax = Math.floor((net * l.taxRate) / 100);
    return { description: l.description, reduced: l.taxRate === 8, net, tax, gross: net + tax, rate: l.taxRate };
  });
  for (const rate of Array.from(new Set(rows.map((r) => r.rate)))) {
    const group = rows.filter((r) => r.rate === rate);
    const expected = Math.floor((group.reduce((s, r) => s + r.net, 0) * rate) / 100);
    const diff = expected - group.reduce((s, r) => s + r.tax, 0);
    if (diff !== 0) {
      const largest = group.reduce((a, b) => (b.net > a.net ? b : a));
      largest.tax += diff;
      largest.gross += diff;
    }
  }
  return rows.map((r) => ({
    description: r.description,
    reduced: r.reduced,
    net: r.net,
    tax: r.tax,
    gross: r.gross,
  }));
}

/** "YYYY-MM-DD" を "YYYY/M/D"（請求書の日付表記）にする */
export function formatSlashDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}/${m}/${d}`;
}

/** 宛名を1行で表示できる目安の文字数（これを超えたら法人名と医院名の区切りで改行する） */
const NAME_LINE_CHARS = 14;

/**
 * 帳票の宛名を行に分ける（ランサイド様要望 2026-10-08: 長い法人名の折り返し位置を手前に）。
 * 長い宛名で空白（全角・半角）を含む場合は、最初の空白で「法人名」「医院名」に分けて改行する。
 * 空白がない場合は1行のまま返し、表示側の幅で折り返す。
 */
export function splitCustomerName(name: string): string[] {
  const trimmed = name.trim();
  if (trimmed.length <= NAME_LINE_CHARS) return [trimmed];
  const m = trimmed.match(/^(.+?)[\s\u3000]+(.+)$/);
  return m ? [m[1], m[2]] : [trimmed];
}
