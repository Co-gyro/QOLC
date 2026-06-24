/**
 * LINE 連携で投げる例外型。
 * メッセージにシークレット（channel secret / access token / 鍵）を含めないこと。
 */

/** LINE 設定（環境変数）不足・不正 */
export class LineConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LineConfigError";
  }
}

/** id_token / state / Webhook 署名の検証失敗 */
export class LineVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LineVerificationError";
  }
}

/** LINE API（トークン交換・push 等）の通信・応答エラー */
export class LineApiError extends Error {
  /** HTTP ステータス（取得できた場合） */
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "LineApiError";
    this.status = status;
  }
}
