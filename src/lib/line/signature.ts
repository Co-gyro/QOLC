/**
 * LINE Webhook 署名検証。
 *
 * 仕様（Messaging API）:
 *   X-Line-Signature = base64( HMAC-SHA256( channelSecret, requestRawBody ) )
 *   生のリクエストボディ（パース前のバイト列）で計算する必要がある。
 */
import { createHmac } from "node:crypto";
import { safeEqual } from "./encoding";

/**
 * Webhook 署名を検証する。
 * @param rawBody 生のリクエストボディ（文字列 or Buffer。再シリアライズしたものは不可）
 * @param signature X-Line-Signature ヘッダの値
 * @param channelSecret Messaging チャネルの Channel Secret
 * @returns 署名が一致すれば true
 */
export function verifyLineSignature(
  rawBody: string | Buffer,
  signature: string | null | undefined,
  channelSecret: string
): boolean {
  if (!signature) return false;
  const body = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  const expected = createHmac("sha256", channelSecret).update(body).digest("base64");
  return safeEqual(expected, signature);
}
