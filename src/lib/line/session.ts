/**
 * LINE 本人確認後の Supabase セッション確立（サーバー専用）。
 *
 * パスワードを介さずにセッションを発行するため、admin の generateLink で
 * magiclink の token_hash を取得し、Cookie 書き込み可能なサーバークライアントで
 * verifyOtp して認証 Cookie をセットする。
 *
 * セキュリティ: token_hash はワンタイムで即時消費する。ログ出力しない。
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 指定メールのユーザーに対してセッションを確立する。
 * @param admin service_role クライアント（generateLink 用）
 * @param cookieClient Cookie を書き込めるサーバークライアント（verifyOtp 用）
 * @param email 対象ユーザーのメール（合成 LINE メール）
 * @throws セッション確立に失敗した場合
 */
export async function establishSessionForEmail(
  admin: SupabaseClient,
  cookieClient: SupabaseClient,
  email: string
): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties?.hashed_token) {
    throw new Error(`セッション用リンクの生成に失敗しました: ${error?.message ?? "unknown"}`);
  }

  const { error: otpErr } = await cookieClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (otpErr) {
    throw new Error(`セッション確立に失敗しました: ${otpErr.message}`);
  }
}
