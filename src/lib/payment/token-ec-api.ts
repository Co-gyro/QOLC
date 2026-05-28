/**
 * USEN PSP トークン式EC決済API（トークン式EC決済API仕様書 20260210 準拠）
 *
 * フロントの ec-payment-web-adapter-token が生成したトークンを用いて、
 * 自社サーバーから USEN のEC決済を実行する。
 *
 * - ベースURL: ec-payment-uhup（JSON）
 * - チェックコード: "HM" + HMAC-SHA256(jutyu_cd "," sum_price)
 * - 決済初期化API: POST /i/token/init（member_id 指定で会員登録）
 * - 決済API:       POST /i/pay（3DS後、OnPaymentStart の check_cd をそのまま使用）
 * - 会員情報取得:   GET /member/card（X-Check-Cd ヘッダ）
 */
import { requestJson, joinUrl } from "./usen-client";
import { generateCheckCode, type UsenKeyType } from "./hmac";
import { UsenApiError } from "./errors";

const ALGO = "sha256" as const;

/**
 * group_id を環境変数から取得（未設定なら undefined）。
 * 設定されている場合は、配下モール宛の決済リクエストをサイト鍵で署名できる
 * （USEN推奨方式。会員ID決済APIにも隠しパラメータとして指定可能）。
 */
function groupId(): string | undefined {
  const v = process.env.USEN_GROUP_ID;
  return v && v.length > 0 ? v : undefined;
}

/**
 * トークン式チェックコードに使う鍵種別。
 * - USEN_GROUP_ID 設定時: group_id 配下モールはサイト鍵で署名する仕様のため強制 site
 * - 未設定時: USEN_TOKEN_CHECK_KEY_TYPE で切替（既定 mall、後方互換）
 */
function checkKeyType(): UsenKeyType {
  if (groupId()) return "site";
  const v = process.env.USEN_TOKEN_CHECK_KEY_TYPE;
  return v === "site" ? "site" : "mall";
}

function ecBaseUrl(): string {
  const url = process.env.USEN_TOKEN_EC_API_BASE_URL;
  if (!url) throw new UsenApiError("USEN_TOKEN_EC_API_BASE_URL が設定されていません");
  return url;
}

/** 3Dセキュア認証用カード会員情報（最低1つの連絡先が必須） */
export interface ThreeDsCardholderInfo {
  email?: string;
  mobile_phone_cc?: string;
  mobile_phone_subscriber?: string;
  [key: string]: string | undefined;
}

export interface TokenInitParams {
  /** [モールコード4桁]-[数字7桁]（自動採番時は末尾省略） */
  jutyu_cd: string;
  sum_price: number;
  /** yyyy/MM/dd */
  jutyu_day: string;
  /** フロントの generateToken で得た暗号化トークン（BASE64） */
  token: string;
  card_limit_yyyy: string;
  card_limit_mm: string;
  cardholder_name: string;
  /** 会員登録する場合に指定 */
  member_id?: string;
  /** capture（即時売上）, member-modify をカンマ区切り */
  option?: string;
  /** 一括:10 等。省略時 10 */
  pay_method?: string;
  three_ds_cardholder_info: ThreeDsCardholderInfo;
}

export interface TokenInitResponse {
  result: "ok" | "ng" | string;
  code: string;
  jutyu_cd?: string;
  three_ds_required?: boolean;
  check_cd?: string;
  browser_info_collect_url?: string;
  monitoring_url?: string;
}

/**
 * 決済初期化API（/i/token/init）。check_cd を生成して USEN を呼ぶ。
 * レスポンスはそのままフロントへ返却する（3DS認証が開始される）。
 */
export async function tokenInit(
  params: TokenInitParams,
  fetchImpl?: typeof fetch
): Promise<TokenInitResponse> {
  const check_cd = generateCheckCode(ALGO, checkKeyType(), [params.jutyu_cd, params.sum_price]);
  const gid = groupId();
  const body = {
    jutyu_cd: params.jutyu_cd,
    sum_price: params.sum_price,
    jutyu_day: params.jutyu_day,
    token: params.token,
    card_limit_yyyy: params.card_limit_yyyy,
    card_limit_mm: params.card_limit_mm,
    cardholder_name: params.cardholder_name,
    check_cd,
    ...(gid ? { group_id: gid } : {}),
    ...(params.member_id ? { member_id: params.member_id } : {}),
    ...(params.option ? { option: params.option } : {}),
    ...(params.pay_method ? { pay_method: params.pay_method } : {}),
    three_ds_cardholder_info: params.three_ds_cardholder_info,
  };
  return requestJson<TokenInitResponse>({
    url: joinUrl(ecBaseUrl(), "/i/token/init"),
    body,
    fetchImpl,
  });
}

export interface PayResponse {
  result: "ok" | "ng" | string;
  code: string;
  jutyu_cd?: string;
  brand?: string;
  member_id?: string;
}

/**
 * 決済API（/i/pay）。3DS後の OnPaymentStart で受け取った check_cd をそのまま使う
 * （ここでは再生成しない）。
 */
export async function pay(
  args: { jutyu_cd: string; token: string; check_cd: string },
  fetchImpl?: typeof fetch
): Promise<PayResponse> {
  const gid = groupId();
  return requestJson<PayResponse>({
    url: joinUrl(ecBaseUrl(), "/i/pay"),
    body: {
      jutyu_cd: args.jutyu_cd,
      token: args.token,
      check_cd: args.check_cd,
      ...(gid ? { group_id: gid } : {}),
    },
    fetchImpl,
  });
}

/** result === "ok" を成功とみなす */
export function isTokenOk(r: { result?: string }): boolean {
  return r.result === "ok";
}

/**
 * resident_account_id から会員ID（USEN member_id）を導出する。
 * 形式: "M" + UUIDのハイフンなし32桁（英数のみ、48桁以内）。
 */
export function deriveMemberId(residentAccountId: string): string {
  return "M" + residentAccountId.replace(/-/g, "");
}

/** 会員IDから resident_account_id を復元する（不正な形式なら null） */
export function residentAccountIdFromMemberId(memberId: string): string | null {
  const m = /^M([0-9a-fA-F]{32})$/.exec(memberId);
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
