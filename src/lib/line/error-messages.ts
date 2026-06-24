/**
 * LINE ログイン/招待フローのエラーコード → 利用者向け日本語メッセージ。
 * クライアント・サーバー双方から参照する（シークレットに依存しない純粋マップ）。
 */
const LINE_ERROR_MESSAGES: Record<string, string> = {
  line_unavailable: "LINEログインは現在ご利用いただけません。",
  line_cancelled: "LINEログインがキャンセルされました。",
  line_state: "セッションの有効期限が切れました。お手数ですが、もう一度お試しください。",
  line_token: "LINE認証に失敗しました。もう一度お試しください。",
  line_verify: "LINE認証の確認に失敗しました。もう一度お試しください。",
  line_session: "ログイン処理に失敗しました。もう一度お試しください。",
  line_link: "アカウントの連携に失敗しました。施設へお問い合わせください。",
  line_unregistered:
    "このLINEアカウントは未登録です。施設から届いた招待リンクからご登録ください。",
  invite_notfound: "招待が見つかりませんでした。リンクをご確認ください。",
  invite_used: "この招待は既に使用されています。",
  invite_expired: "招待の有効期限が切れています。施設へ再発行をご依頼ください。",
  invite_owner: "この入居者には既に支払い担当者が登録されています。",
  no_profile: "アカウント情報が見つかりませんでした。施設へお問い合わせください。",
};

/**
 * エラーコードに対応する利用者向けメッセージを返す。
 * 未知のコードは null（メッセージ非表示）。
 */
export function lineErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return LINE_ERROR_MESSAGES[code] ?? null;
}
