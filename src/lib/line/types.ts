/**
 * LINE 連携の共通型定義。
 */

/** LINE Login（OAuth2 / OIDC）チャネル設定 */
export interface LineLoginConfig {
  /** Login チャネルの Channel ID（= OIDC aud / client_id） */
  channelId: string;
  /** Login チャネルの Channel Secret（id_token の HS256 署名鍵・state 署名にも使用） */
  channelSecret: string;
  /** OAuth コールバック URL（LINE Developers に登録した値と完全一致が必要） */
  redirectUri: string;
}

/** Messaging API（LINE 公式アカウント）チャネル設定 */
export interface LineMessagingConfig {
  /** 長期チャネルアクセストークン */
  channelAccessToken: string;
  /** Messaging チャネルの Channel Secret（Webhook 署名検証に使用） */
  channelSecret: string;
}

/** LINE OIDC id_token のクレーム（必要分のみ） */
export interface LineIdTokenClaims {
  /** 発行者（"https://access.line.me"） */
  iss: string;
  /** LINE ユーザーID（一意・恒久） */
  sub: string;
  /** audience（= Channel ID） */
  aud: string;
  /** 有効期限（UNIX 秒） */
  exp: number;
  /** 発行時刻（UNIX 秒） */
  iat: number;
  /** リプレイ防止 nonce（authorize 時に渡した値） */
  nonce?: string;
  /** 表示名（scope に profile を含む場合） */
  name?: string;
  /** プロフィール画像 URL */
  picture?: string;
  /** メールアドレス（scope に email を含み、ユーザーが許可した場合のみ） */
  email?: string;
}

/** authorize へ遷移する前に保持し、コールバックで検証する state ペイロード */
export interface LineStatePayload {
  /** CSRF 兼リプレイ防止のランダム nonce（id_token.nonce と突合） */
  nonce: string;
  /** ログイン成功後の遷移先パス（オープンリダイレクト防止のため内部パスのみ） */
  next?: string;
  /** 招待トークン（招待経由の新規家族登録フローの場合） */
  inviteToken?: string;
  /** 発行時刻（UNIX 秒）。有効期限判定に使用 */
  iat: number;
}

/** LINE トークンエンドポイントのレスポンス */
export interface LineTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  id_token?: string;
}
