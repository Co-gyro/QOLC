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

/** 今日の日付（日本時間 "YYYY-MM-DD"）。サーバーが UTC でも日付がずれないようにする */
export function todayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 今日時点のサービス提供月（"YYYY-MM"・日本時間）を返す */
export function currentMonth(): string {
  return todayJst().slice(0, 7);
}

/** "YYYY-MM-DD" に日数を足す */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 実際の課金日を決める。
 * 課金は毎朝の自動処理で行うため、予定日が今日以前なら翌日（翌朝）に課金する。
 */
export function effectiveChargeDate(plannedDate: string, today: string): string {
  return plannedDate <= today ? addDays(today, 1) : plannedDate;
}

/**
 * 入金予定日（UD → 加盟店への支払日）。
 * 1〜15日の決済分は翌月15日、16日〜末日の決済分は翌月末日。
 */
export function payoutDateFor(chargeDate: string): string {
  const [y, m, d] = chargeDate.split("-").map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const day = d <= 15 ? 15 : new Date(nextY, nextM, 0).getDate();
  return `${nextY}-${String(nextM).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 決済確定を取り消せるか（課金日の前日まで）。
 * 課金日当日の朝に自動課金が走るため、当日以降は取消（売上取消・返品）の扱いになる。
 */
export function canCancelConfirmation(scheduledDate: string, today: string): boolean {
  return today < scheduledDate;
}

/** 直近 n か月（当月を先頭に新しい順）の "YYYY-MM" */
export function recentMonths(n: number, from: string = currentMonth()): string[] {
  const months = [from];
  while (months.length < n) months.push(previousMonth(months[months.length - 1]));
  return months;
}

/** "YYYY-MM" の翌月を返す */
export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
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
  const sign = amount < 0 ? "-" : "";
  return `${sign}¥${Math.abs(amount).toLocaleString("ja-JP")}`;
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

/** 請求メールの既定の件名 */
export function defaultMailSubject(month: string): string {
  return `【株式会社ランサイド】${formatMonthJa(month)}サービス分 ご請求明細のご案内`;
}

/**
 * 請求明細メールの件名・本文を組み立てる。
 * ランサイド様の現行送付メールの文面をベースに、追記コメントを差し込む。
 * 金額・明細・決済日の行は常に請求データから自動で差し込み、手で書き換えられない
 * （メールと実際の課金額・課金日の食い違いを防ぐため）。
 */
export function buildInvoiceMail(input: {
  customerName: string;
  contactName: string;
  month: string;
  total: number;
  chargeDate: string;
  lines: UdpayInvoiceLine[];
  subject?: string;
  comment?: string;
}): { subject: string; body: string; fixedBlock: string } {
  const monthJa = formatMonthJa(input.month);
  const lineTexts = input.lines
    .map((l) => `・${l.description}: ${formatYen(l.unitPrice * l.quantity)}（税抜）`)
    .join("\n");
  const fixedBlock = `${lineTexts}

ご請求金額合計: ${formatYen(input.total)}（税込）

※サービス分の金額はご登録いただいているクレジットカードにて${formatDateJa(input.chargeDate)}に自動決済となります（お振込の必要はございません）。`;
  const comment = input.comment?.trim();
  const body = `${input.contactName}先生

いつも大変お世話になっております。
株式会社ランサイド・総務事務担当です。

${monthJa}サービス分のご請求明細をお送りいたします。
内容のご確認をお願いいたします。
${comment ? `\n${comment}\n` : ""}
${fixedBlock}

ご不明な点等ございましたらお手数ですが担当者までご連絡お願いいたします。

引き続きよろしくお願いいたします。`;
  return { subject: input.subject?.trim() || defaultMailSubject(input.month), body, fixedBlock };
}

/** キーワードが顧客の名前・担当者・メールのどれかに含まれるか（大文字小文字無視） */
export function matchesKeyword(
  q: string | undefined,
  fields: (string | undefined)[],
): boolean {
  const key = q?.trim().toLowerCase();
  if (!key) return true;
  return fields.some((f) => f?.toLowerCase().includes(key));
}
