/**
 * LINE OIDC id_token のローカル検証。
 *
 * LINE Login の id_token は JWT で、チャネルシークレットを鍵とする **HS256** で署名される。
 * そのためネットワークなしでローカル検証できる（JWKS 取得不要）。
 *
 * 検証項目（OIDC / LINE 仕様）:
 *   - header.alg === "HS256"
 *   - 署名（HMAC-SHA256, channelSecret）一致
 *   - iss === "https://access.line.me"
 *   - aud === channelId（自チャネル宛て）
 *   - exp 未経過
 *   - nonce が期待値（authorize で渡した値）と一致
 */
import { createHmac } from "node:crypto";
import { base64UrlDecode, base64UrlEncode, safeEqual } from "./encoding";
import type { LineIdTokenClaims } from "./types";
import { LineVerificationError } from "./errors";

/** LINE が発行する id_token の iss */
const EXPECTED_ISS = "https://access.line.me";

/**
 * id_token を検証してクレームを返す。
 * @param idToken LINE トークンエンドポイントが返す id_token（JWT）
 * @param channelId 自 Login チャネルの Channel ID（aud 期待値）
 * @param channelSecret 署名検証鍵
 * @param expectedNonce authorize 時に渡した nonce（リプレイ防止）
 * @param nowSec 現在時刻（UNIX 秒）。テスト用に注入可能
 * @throws {LineVerificationError} いずれかの検証に失敗した場合
 */
export function verifyLineIdToken(
  idToken: string,
  channelId: string,
  channelSecret: string,
  expectedNonce: string,
  nowSec: number
): LineIdTokenClaims {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new LineVerificationError("id_token の形式が不正です");
  }
  const [headerB64, payloadB64, sigB64] = parts;

  // ヘッダ検証（alg 固定 — alg=none 等のダウングレード攻撃を防ぐ）
  let header: { alg?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
  } catch {
    throw new LineVerificationError("id_token ヘッダのデコードに失敗しました");
  }
  if (header.alg !== "HS256") {
    throw new LineVerificationError(`想定外の署名アルゴリズムです: ${String(header.alg)}`);
  }

  // 署名検証
  const expectedSig = base64UrlEncode(
    createHmac("sha256", channelSecret).update(`${headerB64}.${payloadB64}`).digest()
  );
  if (!safeEqual(expectedSig, sigB64)) {
    throw new LineVerificationError("id_token の署名が一致しません");
  }

  // クレーム検証
  let claims: LineIdTokenClaims;
  try {
    claims = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as LineIdTokenClaims;
  } catch {
    throw new LineVerificationError("id_token ペイロードのデコードに失敗しました");
  }

  if (claims.iss !== EXPECTED_ISS) {
    throw new LineVerificationError("id_token の iss が不正です");
  }
  if (claims.aud !== channelId) {
    throw new LineVerificationError("id_token の aud が自チャネルと一致しません");
  }
  if (typeof claims.exp !== "number" || claims.exp < nowSec) {
    throw new LineVerificationError("id_token の有効期限が切れています");
  }
  if (!claims.sub) {
    throw new LineVerificationError("id_token に sub（ユーザーID）が含まれていません");
  }
  if (!claims.nonce || !safeEqual(claims.nonce, expectedNonce)) {
    throw new LineVerificationError("id_token の nonce が一致しません（リプレイの可能性）");
  }

  return claims;
}
