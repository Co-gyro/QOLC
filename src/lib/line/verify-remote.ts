/**
 * LINE 公式の id_token 検証エンドポイントによる検証。
 *
 *   POST https://api.line.me/oauth2/v2.1/verify
 *     id_token, client_id（=Channel ID）, nonce?（任意）
 *
 * 署名方式（HS256 / ES256）に依存せず LINE 側で署名・iss・aud・exp・nonce を検証し、
 * 検証済みクレームを返す。LIFF の id_token は ES256 で発行されるためローカル(HS256)検証
 * では弾かれる。本エンドポイントは両方式に対応するため LIFF / Web 双方で利用できる。
 */
import type { LineIdTokenClaims } from "./types";
import { LineVerificationError } from "./errors";

const VERIFY_ENDPOINT = "https://api.line.me/oauth2/v2.1/verify";

/**
 * id_token を LINE の検証エンドポイントで検証し、クレームを返す。
 * @param idToken 検証対象の id_token
 * @param channelId 自 LINE Login チャネルの Channel ID（aud 検証に使う client_id）
 * @param opts.nonce 検証する nonce（指定時のみ LINE 側で照合。LIFF では通常未指定）
 * @throws {LineVerificationError} 検証失敗・通信失敗時
 */
export async function verifyLineIdTokenRemote(
  idToken: string,
  channelId: string,
  opts: { nonce?: string } = {},
  fetchImpl: typeof fetch = fetch
): Promise<LineIdTokenClaims> {
  const body = new URLSearchParams({ id_token: idToken, client_id: channelId });
  if (opts.nonce) body.set("nonce", opts.nonce);

  let res: Response;
  try {
    res = await fetchImpl(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    throw new LineVerificationError(`id_token 検証の通信に失敗しました: ${(e as Error).message}`);
  }

  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new LineVerificationError("id_token 検証応答の解析に失敗しました");
  }

  if (!res.ok) {
    const detail = (json.error_description as string) || (json.error as string) || `HTTP ${res.status}`;
    throw new LineVerificationError(`id_token の検証に失敗しました: ${detail}`);
  }

  // 検証成功。LINE は検証済みクレーム（iss/sub/aud/exp/iat/name/...）を返す。
  if (!json.sub) {
    throw new LineVerificationError("検証応答に sub が含まれていません");
  }
  return json as unknown as LineIdTokenClaims;
}
