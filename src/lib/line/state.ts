/**
 * OAuth state トークンの署名・検証（ステートレス CSRF 対策）。
 *
 * authorize へ遷移する前にペイロード（nonce / next / inviteToken / iat）を
 * channel secret で HMAC 署名して state とし、同じ値を HttpOnly Cookie にも保存する。
 * コールバックでは「state パラメータの署名検証」と「Cookie との二重送信一致」の
 * 両方を確認することで CSRF とリプレイを防ぐ。
 *
 * 形式: base64url(JSON payload) + "." + base64url(HMAC-SHA256)
 */
import { createHmac } from "node:crypto";
import { base64UrlDecode, base64UrlEncode, safeEqual } from "./encoding";
import type { LineStatePayload } from "./types";
import { LineVerificationError } from "./errors";

/** オープンリダイレクト防止: 内部パス（"/foo"）のみ許可する。 */
function sanitizeNext(next: string | undefined): string | undefined {
  if (!next) return undefined;
  // "//" や "/\" はスキーム相対 URL になり得るため弾く
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return undefined;
  return next;
}

/**
 * state ペイロードに署名してトークン文字列を生成する。
 */
export function signState(payload: LineStatePayload, channelSecret: string): string {
  const safePayload: LineStatePayload = { ...payload, next: sanitizeNext(payload.next) };
  const body = base64UrlEncode(JSON.stringify(safePayload));
  const sig = base64UrlEncode(createHmac("sha256", channelSecret).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * state トークンを検証し、ペイロードを返す。
 * @param ttlSec 有効期限（秒）。iat からの経過がこれを超えたら失効
 * @param nowSec 現在時刻（UNIX 秒）。テスト用に注入可能
 * @throws {LineVerificationError} 署名不一致・形式不正・期限切れ
 */
export function verifyState(
  token: string,
  channelSecret: string,
  ttlSec: number,
  nowSec: number
): LineStatePayload {
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new LineVerificationError("state の形式が不正です");
  }
  const [body, sig] = parts;
  const expected = base64UrlEncode(createHmac("sha256", channelSecret).update(body).digest());
  if (!safeEqual(expected, sig)) {
    throw new LineVerificationError("state の署名が一致しません");
  }

  let payload: LineStatePayload;
  try {
    payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as LineStatePayload;
  } catch {
    throw new LineVerificationError("state のデコードに失敗しました");
  }

  if (typeof payload.iat !== "number" || nowSec - payload.iat > ttlSec) {
    throw new LineVerificationError("state の有効期限が切れています");
  }
  if (!payload.nonce || typeof payload.nonce !== "string") {
    throw new LineVerificationError("state の nonce が不正です");
  }
  return payload;
}
