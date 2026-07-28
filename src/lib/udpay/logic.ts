import type { UdpayInvoiceLine } from "./types";

/**
 * UD Payment（仮）デモの純粋ロジック。
 * ストアや I/O に依存しない計算のみを置く（ユニットテスト対象）。
 */

/** 請求合計（税抜小計・消費税・税込合計）。消費税は請求書単位で切り捨て */
export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * 明細行から請求合計を計算する。
 * 単価は税抜。消費税は税率ごとに小計へ乗じて切り捨て（現行ランサイド請求書と同方式）。
 */
export function computeTotals(lines: UdpayInvoiceLine[]): InvoiceTotals {
  const byRate = new Map<number, number>();
  for (const line of lines) {
    const amount = line.unitPrice * line.quantity;
    byRate.set(line.taxRate, (byRate.get(line.taxRate) ?? 0) + amount);
  }
  let subtotal = 0;
  let tax = 0;
  byRate.forEach((amount, rate) => {
    subtotal += amount;
    tax += Math.floor((amount * rate) / 100);
  });
  return { subtotal, tax, total: subtotal + tax };
}

/**
 * サービス提供月（"YYYY-MM"）とアニバーサリー日から課金予定日を返す。
 * 課金はサービス提供月の翌月。日は月末を超えないようにクランプする。
 */
export function chargeDateFor(month: string, anniversaryDay: number): string {
  const [y, m] = month.split("-").map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const lastDay = new Date(nextY, nextM, 0).getDate();
  const day = Math.min(Math.max(anniversaryDay, 1), lastDay);
  return `${nextY}-${String(nextM).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 今日時点のサービス提供月（"YYYY-MM"）を返す */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" の前月を返す */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return `${prevY}-${String(prevM).padStart(2, "0")}`;
}

/** "YYYY-MM" を「YYYY年M月」表記にする */
export function formatMonthJa(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

/** "YYYY-MM-DD" を「YYYY年M月D日」表記にする */
export function formatDateJa(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/** 金額を「¥1,234,567」表記にする */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

/**
 * カード番号の簡易バリデーション（デモ用: 桁数と Luhn チェックのみ）。
 * 実カード情報は保存せず、末尾4桁のマスク表示のみに使う。
 */
export function validateCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/[\s-]/g, "");
  if (!/^\d{14,16}$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** カード番号からマスク表示（末尾4桁のみ）を作る */
export function maskCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/[\s-]/g, "");
  return `**** **** **** ${digits.slice(-4)}`;
}

/** カード番号の先頭からブランド表示名を推定する（デモ用の簡易判定） */
export function detectBrand(cardNumber: string): string {
  const digits = cardNumber.replace(/[\s-]/g, "");
  if (digits.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(digits)) return "Mastercard";
  if (/^35/.test(digits)) return "JCB";
  return "カード";
}

/**
 * 請求明細メール（デモ）の件名・本文を組み立てる。
 * ランサイド様の現行送付メールの文面をベースにしている。
 */
export function buildInvoiceMail(input: {
  customerName: string;
  contactName: string;
  month: string;
  total: number;
  chargeDate: string;
  lines: UdpayInvoiceLine[];
}): { subject: string; body: string } {
  const monthJa = formatMonthJa(input.month);
  const lineTexts = input.lines
    .map(
      (l) =>
        `・${l.description}: ${formatYen(l.unitPrice * l.quantity)}（税抜）`,
    )
    .join("\n");
  const subject = `【株式会社ランサイド】${monthJa}サービス分 ご請求明細のご案内`;
  const body = `${input.contactName}先生

いつも大変お世話になっております。
株式会社ランサイド・総務事務担当です。

${monthJa}サービス分のご請求明細をお送りいたします。
内容のご確認をお願いいたします。

${lineTexts}

ご請求金額合計: ${formatYen(input.total)}（税込）

※サービス分の金額はご登録いただいているクレジットカードにて${formatDateJa(input.chargeDate)}に自動決済となります（お振込の必要はございません）。

ご不明な点等ございましたらお手数ですが担当者までご連絡お願いいたします。

引き続きよろしくお願いいたします。`;
  return { subject, body };
}
