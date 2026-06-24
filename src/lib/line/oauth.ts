/**
 * LINE Login（OAuth2 / OIDC）の authorize URL 構築とトークン交換。
 *
 * 認可エンドポイント : https://access.line.me/oauth2/v2.1/authorize
 * トークンエンドポイント: https://api.line.me/oauth2/v2.1/token
 */
import { randomBytes } from "node:crypto";
import { base64UrlEncode } from "./encoding";
import type { LineLoginConfig, LineTokenResponse } from "./types";
import { LineApiError } from "./errors";

const AUTHORIZE_ENDPOINT = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_ENDPOINT = "https://api.line.me/oauth2/v2.1/token";

/** CSRF / nonce 用のランダム文字列（URL セーフ）を生成する。 */
export function generateNonce(byteLength = 24): string {
  return base64UrlEncode(randomBytes(byteLength));
}

/**
 * LINE 認可画面への遷移 URL を構築する。
 * @param config Login チャネル設定
 * @param state 署名済み state トークン
 * @param nonce id_token に埋め込ませる nonce（state.nonce と同値）
 * @param scopes 要求スコープ（既定: openid profile）
 */
export function buildAuthorizeUrl(
  config: LineLoginConfig,
  state: string,
  nonce: string,
  scopes: readonly string[] = ["openid", "profile"]
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.channelId,
    redirect_uri: config.redirectUri,
    state,
    scope: scopes.join(" "),
    nonce,
  });
  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

/**
 * 認可コードをアクセストークン / id_token に交換する。
 * @throws {LineApiError} HTTP エラー・応答不正の場合
 */
export async function exchangeCodeForToken(
  config: LineLoginConfig,
  code: string,
  fetchImpl: typeof fetch = fetch
): Promise<LineTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.channelId,
    client_secret: config.channelSecret,
  });

  let res: Response;
  try {
    res = await fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    throw new LineApiError(`LINE トークン交換の通信に失敗しました: ${(e as Error).message}`);
  }

  if (!res.ok) {
    // エラーボディにシークレットは含めない（LINE はエラー説明のみ返す）
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* noop */
    }
    throw new LineApiError(`LINE トークン交換に失敗しました (HTTP ${res.status}) ${detail}`, res.status);
  }

  return (await res.json()) as LineTokenResponse;
}
