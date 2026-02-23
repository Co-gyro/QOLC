// ==========================================
// QOLC - ユーティリティ関数
// ==========================================

/**
 * 金額を日本円フォーマットで表示
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(amount);
}

/**
 * 日付を日本語フォーマットで表示
 */
export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}

/**
 * 請求月を表示用フォーマットに変換
 */
export function formatBillingMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}年${parseInt(month)}月`;
}

/**
 * classNameを結合するヘルパー
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
