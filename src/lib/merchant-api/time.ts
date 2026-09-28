/**
 * 日本時間の日付・日時ユーティリティ（加盟店API用）
 *
 * Vercel の実行環境は UTC のため、getFullYear() 等のローカル時刻関数は使わない。
 * 日本はサマータイムが無いので、UTC に +9時間して UTC の各フィールドを読む。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 2桁ゼロ埋め */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date を「JSTの壁時計」を UTC フィールドに持つ Date に変換する */
function shiftToJst(d: Date): Date {
  return new Date(d.getTime() + JST_OFFSET_MS);
}

/**
 * ISO 8601・+09:00 付きの文字列（接続仕様書 第3章の日時形式）。
 * 例: 2026-09-08T14:52:11+09:00
 */
export function toJstIso(d: Date): string {
  const j = shiftToJst(d);
  return (
    `${j.getUTCFullYear()}-${pad2(j.getUTCMonth() + 1)}-${pad2(j.getUTCDate())}` +
    `T${pad2(j.getUTCHours())}:${pad2(j.getUTCMinutes())}:${pad2(j.getUTCSeconds())}+09:00`
  );
}

/** DB の timestamptz 文字列（または null）を JST ISO に変換する */
export function toJstIsoOrNull(value: string | null | undefined): string | null {
  return value ? toJstIso(new Date(value)) : null;
}

/** JST の日付 YYYY-MM-DD */
export function jstDateString(d: Date): string {
  const j = shiftToJst(d);
  return `${j.getUTCFullYear()}-${pad2(j.getUTCMonth() + 1)}-${pad2(j.getUTCDate())}`;
}

/** USEN の受注日形式 yyyy/MM/dd（JST） */
export function usenDate(d: Date): string {
  return jstDateString(d).replace(/-/g, "/");
}

/** USEN の決済有効期限形式 yyyy/MM/dd HH:mm（JST・分未満切り捨て） */
export function usenDateTime(d: Date): string {
  const j = shiftToJst(d);
  return `${usenDate(d)} ${pad2(j.getUTCHours())}:${pad2(j.getUTCMinutes())}`;
}

/**
 * YYYY-MM-DD に月数を足す。月末は繰り下げる（11/30 + 3か月 = 2/28 or 2/29）。
 */
export function addMonthsToDateString(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) + months;
  const ny = Math.floor(totalMonths / 12);
  const nm = totalMonths % 12; // 0-11
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad2(nm + 1)}-${pad2(Math.min(d, lastDay))}`;
}

/** YYYY-MM-DD が実在する日付か */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * USEN の日時文字列 "yyyy/mm/dd hh24:mi:ss"（JST）を Date に変換する。形式不正なら null。
 */
export function parseUsenDateTime(value: string | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s) - JST_OFFSET_MS);
}
