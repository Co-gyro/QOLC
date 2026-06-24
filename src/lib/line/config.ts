/**
 * LINE 連携の環境変数ローダー。
 *
 * シークレットは一切ハードコードせず、すべて環境変数経由（CLAUDE.md セキュリティ規約）。
 *   - LINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET : Login チャネル
 *   - LINE_LOGIN_REDIRECT_URI : 未指定なら NEXT_PUBLIC_APP_URL から組み立て
 *   - LINE_MESSAGING_CHANNEL_ACCESS_TOKEN / LINE_MESSAGING_CHANNEL_SECRET : Messaging チャネル
 */
import type { LineLoginConfig, LineMessagingConfig } from "./types";
import { LineConfigError } from "./errors";

/** OAuth コールバックのパス（LINE Developers に登録する URL のパス部） */
export const LINE_CALLBACK_PATH = "/api/auth/line/callback";

/** state の二重送信（CSRF）検証に使う HttpOnly Cookie 名 */
export const LINE_STATE_COOKIE = "qolc_line_oauth_state";

/** state ペイロードの有効期限（秒）。authorize → callback の往復猶予 */
export const LINE_STATE_TTL_SEC = 600;

/**
 * LINE Login チャネル設定を環境変数から取得する。
 * @throws {LineConfigError} 必須値が未設定の場合
 */
export function getLineLoginConfig(): LineLoginConfig {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    throw new LineConfigError(
      "LINE Login の環境変数（LINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET）が未設定です"
    );
  }

  const explicit = process.env.LINE_LOGIN_REDIRECT_URI;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const redirectUri = explicit || (appUrl ? `${appUrl.replace(/\/$/, "")}${LINE_CALLBACK_PATH}` : "");
  if (!redirectUri) {
    throw new LineConfigError(
      "LINE_LOGIN_REDIRECT_URI または NEXT_PUBLIC_APP_URL が未設定でコールバック URL を決定できません"
    );
  }

  return { channelId, channelSecret, redirectUri };
}

/**
 * LINE Messaging API（公式アカウント）設定を環境変数から取得する。
 * @throws {LineConfigError} 必須値が未設定の場合
 */
export function getLineMessagingConfig(): LineMessagingConfig {
  const channelAccessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if (!channelAccessToken || !channelSecret) {
    throw new LineConfigError(
      "LINE Messaging の環境変数（LINE_MESSAGING_CHANNEL_ACCESS_TOKEN / LINE_MESSAGING_CHANNEL_SECRET）が未設定です"
    );
  }
  return { channelAccessToken, channelSecret };
}

/**
 * LINE Login が利用可能か（環境変数が揃っているか）を判定する。
 * UI で「LINE でログイン」ボタンの表示可否に使う（例外を投げない）。
 */
export function isLineLoginConfigured(): boolean {
  return Boolean(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET);
}

/**
 * LINE Messaging（push 通知）が利用可能かを判定する（例外を投げない）。
 */
export function isLineMessagingConfigured(): boolean {
  return Boolean(
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN && process.env.LINE_MESSAGING_CHANNEL_SECRET
  );
}
