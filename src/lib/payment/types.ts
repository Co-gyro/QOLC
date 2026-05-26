/**
 * USEN PSP API 型定義（IF仕様書 1.1.0 / 3DセキュアEC決済導入ガイド 1.0.5 準拠）
 */

/** HMAC アルゴリズム種別 */
export type HmacAlgorithm = "sha256" | "md5";

/** 会員ID決済APIの共通XMLレスポンス（result: ok|ng） */
export interface MemberApiResult {
  jutyu_cd?: string;
  result?: "ok" | "ng" | string;
  /** 処理結果詳細コード（例: 01=与信成功, 40=売上計上完了, 41=対象無し 等） */
  code?: string;
  /** カードブランド（VISA, MASTER, JCB ...） */
  ucorp?: string;
  /** 売上計上日（salesadd のみ） */
  process_day?: string;
  /** site_cd / member_id（会員操作系で返る場合あり） */
  site_cd?: string;
  member_id?: string;
  [key: string]: string | undefined;
}

/** 支払区分（pay_method） */
export type PayMethod = "10" | "21" | "61" | "69" | "80";

/** 会員与信照会（/member/authbymemberid）リクエスト */
export interface AuthByMemberIdParams {
  /** [モールコード]-[7桁] 例: TSJM-0000001 */
  jutyu_cd: string;
  /** 税送料込み金額（最大7桁） */
  amount: number;
  /** 会員IDが登録されているサイトコード */
  site_cd: string;
  member_id: string;
  /** 受注日 yyyy/mm/dd */
  jutyu_day: string;
  pay_method?: PayMethod;
  pay_times?: string;
}

/** 売上計上（/sales/salesadd）リクエスト */
export interface SalesAddParams {
  jutyu_cd: string;
  amount: number;
  /** 売上計上日 yyyy/mm/dd（与信日 ≦ 売上計上日 ≦ 当日） */
  sales_day: string;
}

/** 売上取消（/sales/salescancel）/ 売上返品（/sales/salesreturn）リクエスト */
export interface SalesCancelParams {
  jutyu_cd: string;
  amount: number;
}

/** 与信取消（/auth/void）リクエスト */
export interface AuthVoidParams {
  jutyu_cd: string;
  amount: number;
  /** 取消日 yyyy/mm/dd（受注日ではなく取消実行日） */
  jutyu_day: string;
}

/** 与信会員登録（/member/entrybyjutyucd）リクエスト */
export interface MemberEntryParams {
  site_cd: string;
  member_id: string;
  jutyu_cd: string;
  holder_name?: string;
  remarks?: string;
}

/** 会員情報取得（/member/get）リクエスト */
export interface MemberGetParams {
  site_cd: string;
  member_id: string;
}

/** 取引照会（/search/trade）リクエスト */
export interface SearchTradeParams {
  jutyu_cd: string;
}

// ============================================================
// 3DセキュアEC決済（決済画面表示 API: ec-payment-front/checkout）
// ============================================================

/** 決済画面表示APIのリクエストパラメータ（必須＋主要任意） */
export interface EcCheckoutParams {
  /** [サイト or モールコード]-[7桁]。管理画面で売上を上げる場合はサイトコード */
  jutyu_cd: string;
  /** 受注金額総額（税込）。会員登録のみは 1 円 */
  sum_price: number;
  /** 受注日 yyyy/mm/dd */
  jutyu_day: string;
  /** 会員ID（指定するとカード有効性確認後にカードを紐付け保管） */
  member_id?: string;
  item_name?: string;
  /** 決済有効期限 yyyy/MM/dd HH:mm（最大60日後） */
  expiration_date?: string;
  ret_url?: string;
  ret_url_type?: "POST" | "GET" | "REDIRECT";
  cancel_url?: string;
  cancel_url_method?: "POST" | "GET";
  /** member-modify, capture をカンマ区切りで */
  option?: string;
}

/** ret_url コールバックで戻るパラメータ */
export interface EcReturnParams {
  jutyu_cd: string;
  /** カードブランド（VISA 等）。会員登録成功時に値が入る */
  user_card_corp: string;
  /** 会員ID。会員登録成功時に init 指定値が入る。失敗・未指定はブランク */
  member_id: string;
  /** 判定コード = "HM"+HMAC-SHA256(jutyu_cd, user_card_corp, sum_price) */
  check_cd: string;
}

/** 監査ログのアクション種別 */
export type AuditAction =
  | "ec_checkout"
  | "ec_return"
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
