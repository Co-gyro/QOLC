/**
 * 登録カードの有効期限判定（QOLC・UD Payment 共通）。
 *
 * USEN 会員情報取得（/member/get）が返す expire_yyyy / expire_mm を
 * "YYYYMM" で保存し、今日（日本時間）を基準に状態を判定する。
 * カードは有効期限月の末日まで使える前提。期限月の前月から「期限間近」とし、
 * 更新のご案内（メール・LINE）を出す。
 */

/** 有効期限の状態 */
export type CardExpiryStatus = "valid" | "expiring" | "expired" | "unknown";

/** 状態の表示名 */
export const CARD_EXPIRY_LABELS: Record<CardExpiryStatus, string> = {
  valid: "有効",
  expiring: "期限間近",
  expired: "期限切れ",
  unknown: "未確認",
};

/** "YYYY-MM-DD" または "YYYYMMDD" を年・月の通し番号（年×12＋月−1）にする */
function monthIndexOfDate(ymd: string): number {
  const digits = ymd.replace(/-/g, "");
  return Number(digits.slice(0, 4)) * 12 + Number(digits.slice(4, 6)) - 1;
}

/** "YYYYMM" が正しい有効期限か（月は01〜12） */
export function isValidExpireYm(expireYm: string | null | undefined): expireYm is string {
  if (!expireYm || !/^\d{6}$/.test(expireYm)) return false;
  const mm = Number(expireYm.slice(4, 6));
  return mm >= 1 && mm <= 12;
}

/**
 * USEN の expire_yyyy / expire_mm から "YYYYMM" を作る。
 * 値が欠けている・不正な場合は null（保存しない）。
 */
export function toExpireYm(
  expireYyyy: string | undefined,
  expireMm: string | undefined,
): string | null {
  if (!expireYyyy || !expireMm) return null;
  const ym = `${expireYyyy.trim()}${expireMm.trim().padStart(2, "0")}`;
  return isValidExpireYm(ym) ? ym : null;
}

/**
 * 有効期限の状態を判定する。
 * @param expireYm 有効期限 "YYYYMM"（未取得なら null）
 * @param today 基準日 "YYYY-MM-DD"（日本時間）
 */
export function cardExpiryStatus(
  expireYm: string | null | undefined,
  today: string,
): CardExpiryStatus {
  if (!isValidExpireYm(expireYm)) return "unknown";
  const expire = Number(expireYm.slice(0, 4)) * 12 + Number(expireYm.slice(4, 6)) - 1;
  const now = monthIndexOfDate(today);
  if (now > expire) return "expired";
  if (now >= expire - 1) return "expiring";
  return "valid";
}

/**
 * 今日が更新案内を送る日か（期限月の前月1日・期限月1日）。
 * 毎朝の自動処理から呼び、送付済みかどうかは呼び出し側の送付記録で判定する。
 */
export function isExpiryNoticeDay(expireYm: string | null | undefined, today: string): boolean {
  if (!isValidExpireYm(expireYm) || !today.endsWith("-01")) return false;
  const expire = Number(expireYm.slice(0, 4)) * 12 + Number(expireYm.slice(4, 6)) - 1;
  const now = monthIndexOfDate(today);
  return now === expire - 1 || now === expire;
}

/** "YYYYMM" を「YYYY年M月」にする（未取得は「—」） */
export function formatExpireYm(expireYm: string | null | undefined): string {
  if (!isValidExpireYm(expireYm)) return "—";
  return `${expireYm.slice(0, 4)}年${Number(expireYm.slice(4, 6))}月`;
}
