import { randomBytes } from "node:crypto";

/**
 * UD Payment（本番）の識別子。
 * - USEN 会員ID: "U" + 顧客ID（UUID のハイフン抜き 32 桁）＝33 桁（USEN 上限 48 桁以内）。
 *   QOLC の家族カード（"M" + resident_account_id）と接頭辞で区別し、衝突させない。
 * - カード登録リンクのトークン: 24 バイトの乱数を base64url にした 32 文字（推測困難）。
 */

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** 顧客ID から USEN 会員ID を作る */
export function udpayMemberId(customerId: string): string {
  if (!UUID_RE.test(customerId)) throw new Error("顧客IDの形式が不正です");
  return `U${customerId.replace(/-/g, "").toLowerCase()}`;
}

/** USEN 会員ID から顧客ID（ハイフン付き UUID）に戻す。UD Payment の会員IDでなければ null */
export function customerIdFromUdpayMemberId(memberId: string): string | null {
  const m = memberId.match(/^U([0-9a-f]{32})$/);
  if (!m) return null;
  const h = m[1];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** カード登録リンクのトークンを発行する */
export function newRegistrationToken(): string {
  return randomBytes(24).toString("base64url");
}

/** トークンの形式チェック（DB に問い合わせる前に弾く） */
export function isRegistrationToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(token);
}

/** カード登録リンクの URL（本番は NEXT_PUBLIC_APP_URL=https://app.qolc.jp） */
export function registrationUrl(token: string, baseUrl: string = process.env.NEXT_PUBLIC_APP_URL ?? ""): string {
  return `${baseUrl.replace(/\/$/, "")}/pay/udpay/${token}`;
}
