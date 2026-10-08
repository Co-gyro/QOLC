/**
 * 加盟店API から USEN を呼ぶゲートウェイ（トークン式EC決済API・会員ID決済API）
 *
 * 既存の token-ec-api / member-api は環境変数に固定された接続先を使うため、
 * テスト／本番を資格情報ごとに切り替える本APIでは UsenProfile を受け取る版を用意する。
 * 署名方式は既存実装・USEN仕様と同一:
 *   - /i/token/init: "HM" + HMAC-SHA256("jutyu_cd,sum_price")（トークン式EC決済API仕様書 8.1）
 *   - /search/trade: "HM" + HMAC-MD5("jutyu_cd")（会員ID決済IF仕様書 6.1）
 *   - group_id を付与し、サイト鍵で署名する
 */
import { generateCheckCodeWithKey } from "@/lib/payment/hmac";
import { joinUrl, parseXmlResponse, postForm, requestJson } from "@/lib/payment/usen-client";
import type { UsenProfile } from "./usen-profile";

/** /i/token/init のレスポンス（フロントの SDK へそのまま返す） */
export interface UsenTokenInitResponse {
  result: string;
  code: string;
  jutyu_cd?: string;
  three_ds_required?: boolean;
  check_cd?: string;
  browser_info_collect_url?: string;
  monitoring_url?: string;
}

/** /i/pay のレスポンス */
export interface UsenPayResponse {
  result: string;
  code: string;
  jutyu_cd?: string;
  brand?: string;
}

/** /i/token/init の入力 */
export interface TokenInitInput {
  jutyuCd: string;
  amount: number;
  /** yyyy/MM/dd（JST） */
  jutyuDay: string;
  /** yyyy/MM/dd HH:mm（JST）。セッションの expires_at に合わせる */
  expirationDate: string;
  token: string;
  cardLimitYyyy: string;
  cardLimitMm: string;
  cardholderName: string;
  /** 3Dセキュアのカード会員情報（2025年10月から必須） */
  email: string;
}

/**
 * 決済初期化（/i/token/init）。即時売上（option=capture）・一括払いに固定する。
 * チケットは1回限りの購入のため member_id は渡さない（USEN にカード会員を作らない）。
 */
export async function usenTokenInit(
  profile: UsenProfile,
  input: TokenInitInput,
  fetchImpl?: typeof fetch
): Promise<UsenTokenInitResponse> {
  const checkCd = generateCheckCodeWithKey("sha256", profile.key, [input.jutyuCd, input.amount]);
  return requestJson<UsenTokenInitResponse>({
    url: joinUrl(profile.tokenApiBaseUrl, "/i/token/init"),
    body: {
      jutyu_cd: input.jutyuCd,
      sum_price: input.amount,
      jutyu_day: input.jutyuDay,
      token: input.token,
      card_limit_yyyy: input.cardLimitYyyy,
      card_limit_mm: input.cardLimitMm,
      cardholder_name: input.cardholderName,
      check_cd: checkCd,
      group_id: profile.groupId,
      expiration_date: input.expirationDate,
      option: "capture",
      three_ds_cardholder_info: { email: input.email },
    },
    fetchImpl,
  });
}

/**
 * 決済（/i/pay）。check_cd は SDK の OnPaymentStart で受け取った値をそのまま使う（仕様 8.4）。
 */
export async function usenPay(
  profile: UsenProfile,
  input: { jutyuCd: string; token: string; checkCd: string },
  fetchImpl?: typeof fetch
): Promise<UsenPayResponse> {
  return requestJson<UsenPayResponse>({
    url: joinUrl(profile.tokenApiBaseUrl, "/i/pay"),
    body: {
      jutyu_cd: input.jutyuCd,
      token: input.token,
      check_cd: input.checkCd,
      group_id: profile.groupId,
    },
    fetchImpl,
  });
}

/** 即時売上返品（/auth/return）の結果 */
export interface UsenReturnResult {
  result?: string;
  code?: string;
  ucorp?: string;
  process_day?: string;
  [key: string]: string | undefined;
}

/**
 * 即時売上返品（/auth/return・会員ID決済IF仕様書 3.4）。
 * 売上待ち（締め前）なら売上を削除して与信を取り消し、売上済み（締め後）なら返品データを送る。
 * 1つのAPIで締め日の前後どちらにも対応できるため、加盟店APIの返金はこれに統一する。
 * check_cd は "HM" + HMAC-MD5("jutyu_cd,amount")。成功は result=ok・code=40。
 *
 * @param input.salesDay - 元決済の売上計上日 yyyy/mm/dd（異なるとエラー）
 */
export async function usenReturn(
  profile: UsenProfile,
  input: { jutyuCd: string; amount: number; salesDay: string },
  fetchImpl?: typeof fetch
): Promise<UsenReturnResult> {
  const checkCd = generateCheckCodeWithKey("md5", profile.key, [input.jutyuCd, input.amount]);
  const text = await postForm({
    url: joinUrl(profile.memberApiBaseUrl, "/auth/return"),
    params: {
      jutyu_cd: input.jutyuCd,
      amount: input.amount,
      sales_day: input.salesDay,
      group_id: profile.groupId,
      check_cd: checkCd,
    },
    fetchImpl,
  });
  return parseXmlResponse(text) as UsenReturnResult;
}

/** 取引照会（/search/trade）の結果 */
export interface UsenTradeResult {
  result?: string;
  code?: string;
  status?: string;
  auth_result?: string;
  auth_code?: string;
  process_date?: string;
  amount?: string;
  card_num?: string;
  [key: string]: string | undefined;
}

/**
 * 取引照会（/search/trade）。
 */
export async function usenSearchTrade(
  profile: UsenProfile,
  jutyuCd: string,
  fetchImpl?: typeof fetch
): Promise<UsenTradeResult> {
  const checkCd = generateCheckCodeWithKey("md5", profile.key, [jutyuCd]);
  const text = await postForm({
    url: joinUrl(profile.memberApiBaseUrl, "/search/trade"),
    params: { jutyu_cd: jutyuCd, group_id: profile.groupId, check_cd: checkCd },
    fetchImpl,
  });
  return parseXmlResponse(text) as UsenTradeResult;
}

/** 取引照会の結果を加盟店APIの判断に使う形へ分類したもの */
export type TradeOutcome =
  | { kind: "captured"; amount: number | null; last4: string | null; processedAt: string | undefined }
  | { kind: "refunded" }
  | { kind: "declined"; authCode: string | null }
  | { kind: "authorized_only" }
  | { kind: "voided" }
  | { kind: "not_found" }
  | { kind: "in_progress" }
  | { kind: "unknown"; detail: string };

/**
 * 取引照会の結果を分類する（会員ID決済IF仕様書 6.1.5 の status 一覧に対応）。
 *   sales / sales_reserve               → captured（即時売上の完了。sales_reserve は売上待ち）
 *   sales_return / sales_return_reserve → refunded
 *   auth                                → authorized_only（capture 指定のため通常は起きない）
 *   void                                → voided
 *   unprocessed かつ auth_result=ng     → declined（カード会社・3DSで不成立）
 *   unprocessed                         → in_progress
 *   result=ng code=01（取引履歴無し）    → not_found（/i/token/init 前または未到達）
 */
export function classifyTrade(trade: UsenTradeResult): TradeOutcome {
  if (trade.result === "ng") {
    if (trade.code === "01") return { kind: "not_found" };
    return { kind: "unknown", detail: `ng/${trade.code ?? ""}` };
  }
  if (trade.result !== "ok") return { kind: "unknown", detail: `result=${trade.result ?? ""}` };
  switch (trade.status) {
    case "sales":
    case "sales_reserve": {
      const amount = trade.amount && /^\d+$/.test(trade.amount) ? Number(trade.amount) : null;
      const last4 = trade.card_num && /(\d{4})$/.exec(trade.card_num)?.[1];
      return { kind: "captured", amount, last4: last4 ?? null, processedAt: trade.process_date };
    }
    case "sales_return":
    case "sales_return_reserve":
      return { kind: "refunded" };
    case "auth":
      return { kind: "authorized_only" };
    case "void":
      return { kind: "voided" };
    case "unprocessed":
      return trade.auth_result === "ng"
        ? { kind: "declined", authCode: trade.auth_code ?? null }
        : { kind: "in_progress" };
    default:
      return { kind: "unknown", detail: `status=${trade.status ?? ""}` };
  }
}
