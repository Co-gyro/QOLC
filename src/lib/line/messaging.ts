/**
 * LINE Messaging API（push 通知）クライアントとメッセージ組み立て。
 *
 * push エンドポイント: https://api.line.me/v2/bot/message/push
 *   - 認証: Authorization: Bearer {channelAccessToken}
 *   - 送信先 to はユーザーの LINE userId（= profiles.line_user_id）
 */
import type { LineMessagingConfig } from "./types";
import { LineApiError } from "./errors";

const PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

/** LINE メッセージオブジェクト（本プロジェクトで使う最小集合） */
export type LineMessage =
  | { type: "text"; text: string }
  | Record<string, unknown>;

/**
 * QOLC の通知をシンプルなテキストメッセージに整形する。
 * @param title 見出し（例: 「決済が完了しました」）
 * @param body 本文（任意）
 */
export function buildTextMessage(title: string, body?: string): LineMessage {
  const text = body ? `${title}\n\n${body}` : title;
  // LINE のテキスト上限は 5000 文字。安全側で切り詰める。
  return { type: "text", text: text.slice(0, 4900) };
}

/**
 * 指定ユーザーへ push 送信する。
 * @param config Messaging チャネル設定
 * @param to 送信先 LINE userId
 * @param messages 送信メッセージ（最大 5 件）
 * @throws {LineApiError} HTTP エラーの場合
 */
export async function pushMessage(
  config: LineMessagingConfig,
  to: string,
  messages: LineMessage[],
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (messages.length === 0 || messages.length > 5) {
    throw new LineApiError("push するメッセージ件数は 1〜5 件である必要があります");
  }

  let res: Response;
  try {
    res = await fetchImpl(PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.channelAccessToken}`,
      },
      body: JSON.stringify({ to, messages }),
    });
  } catch (e) {
    throw new LineApiError(`LINE push の通信に失敗しました: ${(e as Error).message}`);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* noop */
    }
    throw new LineApiError(`LINE push に失敗しました (HTTP ${res.status}) ${detail}`, res.status);
  }
}
