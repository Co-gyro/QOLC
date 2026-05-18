/**
 * USEN PSP API 共通型定義
 */

/** HMAC アルゴリズム種別 */
export type HmacAlgorithm = "sha256" | "md5";

/** USEN API レスポンス共通構造 */
export interface UsenApiResponseBase {
  /** USEN 応答コード（"S" 等の成功コード） */
  res_cd?: string;
  /** エラーコード */
  err_cd?: string;
  /** エラーメッセージ */
  err_msg?: string;
}

/** カード登録（EC決済 トークンAPI）初期化リクエスト */
export interface TokenInitRequest {
  site_cd: string;
  mall_cd: string;
  jutyu_cd: string;
  amount: number; // カード登録時は 1（1円与信）
  /** 3DS 必須 */
  acs_flg: "1";
  /** 完了後のリダイレクト先 URL */
  ret_url: string;
}

/** カード登録初期化レスポンス */
export interface TokenInitResponse extends UsenApiResponseBase {
  /** USEN の決済画面 URL */
  redirect_url?: string;
  /** USEN 内部の取引ID */
  trade_id?: string;
}

/** /i/result リクエスト */
export interface TokenResultRequest {
  site_cd: string;
  mall_cd: string;
  jutyu_cd: string;
}

/** /i/result レスポンス */
export interface TokenResultResponse extends UsenApiResponseBase {
  /** 与信ステータス */
  auth_status?: string;
  /** USEN 会員ID（カード登録成功時に払い出される） */
  member_id?: string;
  /** 取引ID */
  trade_id?: string;
}

/** 会員ID 与信リクエスト（/member/authbymemberid） */
export interface AuthByMemberIdRequest {
  site_cd: string;
  mall_cd: string;
  member_id: string;
  jutyu_cd: string;
  amount: number;
}

export interface AuthByMemberIdResponse extends UsenApiResponseBase {
  trade_id?: string;
  auth_status?: string;
}

/** 売上計上 / 取消 / 返金 共通リクエスト */
export interface SalesActionRequest {
  site_cd: string;
  mall_cd: string;
  jutyu_cd: string;
  amount?: number;
}

export interface SalesActionResponse extends UsenApiResponseBase {
  trade_id?: string;
}

/** 与信取消（/auth/void） */
export interface AuthVoidRequest {
  site_cd: string;
  mall_cd: string;
  jutyu_cd: string;
}

export type AuthVoidResponse = SalesActionResponse;

/** 取引照会（/search/trade） */
export interface SearchTradeRequest {
  site_cd: string;
  mall_cd: string;
  jutyu_cd: string;
}

export interface SearchTradeResponse extends UsenApiResponseBase {
  trade_id?: string;
  status?: string;
  amount?: number;
}

/** 会員登録（/member/entrybyjutyucd） */
export interface MemberEntryRequest {
  site_cd: string;
  mall_cd: string;
  jutyu_cd: string;
  member_id: string;
}

export interface MemberEntryResponse extends UsenApiResponseBase {
  member_id?: string;
}

/** 会員情報取得 */
export interface MemberGetRequest {
  site_cd: string;
  mall_cd: string;
  member_id: string;
}

export interface MemberGetResponse extends UsenApiResponseBase {
  member_id?: string;
  /** カード番号下4桁 */
  card_last4?: string;
  /** カードブランド */
  card_brand?: string;
  /** 有効期限 YYMM */
  card_expiry?: string;
}

/** 監査ログのアクション種別 */
export type AuditAction =
  | "token_init"
  | "token_result"
  | "member_entry"
  | "member_get"
  | "member_inactivate"
  | "member_activate"
  | "member_delete"
  | "auth_by_member_id"
  | "sales_add"
  | "sales_cancel"
  | "sales_return"
  | "auth_void"
  | "auth_change"
  | "search_trade";
