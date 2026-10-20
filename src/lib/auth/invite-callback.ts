/**
 * Supabase 認証コールバック URL（招待リンク・リカバリリンク等）の
 * ハッシュフラグメントを解析する純関数群。
 *
 * Supabase の verify エンドポイントは検証後、
 * `#access_token=...&refresh_token=...&type=invite` （成功時）または
 * `#error=access_denied&error_description=...`（期限切れ等）を付けて
 * redirect_to へリダイレクトする。
 */

/** ハッシュ解析の結果 */
export type AuthCallbackResult =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

/**
 * URL のハッシュフラグメント（`#` 以降）を解析し、
 * セッショントークンまたはエラーを取り出す。
 * @param hash `window.location.hash` の値（先頭 `#` の有無は問わない）
 */
export function parseAuthCallbackHash(hash: string): AuthCallbackResult {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return { kind: "none" };

  const params = new URLSearchParams(raw);
  const errorCode = params.get("error");
  if (errorCode) {
    return { kind: "error", message: describeCallbackError(errorCode, params.get("error_description")) };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "tokens", accessToken, refreshToken };
  }
  return { kind: "none" };
}

/**
 * Supabase コールバックのエラーコードを利用者向けの日本語文言にする。
 * @param code `error` パラメータ（例: access_denied）
 * @param description `error_description` パラメータ（英語文）
 */
export function describeCallbackError(code: string, description: string | null): string {
  const desc = (description ?? "").toLowerCase();
  if (desc.includes("expired") || desc.includes("invalid")) {
    return "リンクの有効期限が切れているか、すでに使用済みです。管理者に再発行を依頼してください。";
  }
  if (code === "access_denied") {
    return "リンクを確認できませんでした。管理者に再発行を依頼してください。";
  }
  return "認証エラーが発生しました。管理者にお問い合わせください。";
}

/** パスワード設定リンクの種類（Supabase の generateLink の type） */
export type SetPasswordLinkType = "invite" | "recovery";

/**
 * メールに載せるパスワード設定リンクを作る（app.qolc.jp/set-password?token_hash=…&type=…）。
 * Supabase の action_link（/auth/v1/verify 経由）は Redirect URLs の許可設定に外れると Site URL へ飛び、
 * メールのセキュリティ機能がリンクを先に開くだけで使用済みになるため使わない。
 * ページを開いた本人のブラウザで verifyOtp したときに初めてトークンを使う。
 * @param hashedToken generateLink の properties.hashed_token
 */
export function buildSetPasswordUrl(appUrl: string, hashedToken: string, type: SetPasswordLinkType): string {
  const q = new URLSearchParams({ token_hash: hashedToken, type });
  return `${appUrl.replace(/\/$/, "")}/set-password?${q.toString()}`;
}

/** set-password のクエリから token_hash と type を取り出す（無ければ null） */
export function parseTokenHashQuery(search: string): { tokenHash: string; type: SetPasswordLinkType } | null {
  const params = new URLSearchParams(search);
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (!tokenHash || (type !== "invite" && type !== "recovery")) return null;
  return { tokenHash, type };
}
