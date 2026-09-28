/**
 * 加盟店API の識別子採番
 *
 * session_id は購入者のブラウザURLに載り、そのまま決済画面・中断操作の鍵になるため
 * 推測不能な乱数（130ビット）で採番する。
 */
import { randomBytes } from "node:crypto";

/** Crockford Base32（紛らわしい I/L/O/U を含まない） */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * 暗号論的乱数から Crockford Base32 の文字列を生成する。
 *
 * @param length - 文字数（1文字あたり5ビット）
 */
export function randomBase32(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    // 256 は 32 の倍数なので下位5ビットを使っても偏りは出ない
    out += ALPHABET[bytes[i] & 31];
  }
  return out;
}

/** 決済ID（pay_ + 26文字） */
export function newPaymentId(): string {
  return `pay_${randomBase32(26)}`;
}

/** 決済セッションID（cs_ + 26文字） */
export function newSessionId(): string {
  return `cs_${randomBase32(26)}`;
}

/**
 * 加盟店識別子（X-UD-Merchant-Id に載せる値）。環境が見て分かる接頭辞を付ける。
 *
 * @param environment - 'test' / 'production'
 */
export function newApiMerchantId(environment: "test" | "production"): string {
  return `${environment === "test" ? "mch_test_" : "mch_live_"}${randomBase32(16)}`;
}

/** session_id の形式チェック（URLパラメータの事前検証用） */
export function isSessionId(value: string): boolean {
  return /^cs_[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}

/** payment_id の形式チェック */
export function isPaymentId(value: string): boolean {
  return /^pay_[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}
