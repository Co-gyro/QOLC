/**
 * 加盟店向け決済API のエラー定義（接続仕様書 v1.0 第13章）
 *
 * 本APIは外部の加盟店システムが相手のため、QOLC 内部の apiOk/apiError 形式ではなく
 * 接続仕様書で公開した形式 `{"error":{"code","message","detail"}}` で返す。
 */

/** 接続仕様書 第13章のエラーコード */
export type MerchantApiErrorCode =
  | "invalid_request"
  | "amount_mismatch"
  | "event_date_out_of_range"
  | "return_url_not_allowed"
  | "signature_invalid"
  | "merchant_suspended"
  | "payment_not_found"
  | "order_id_conflict"
  | "session_expired"
  | "limit_exceeded"
  | "rate_limited"
  | "internal_error"
  | "service_unavailable";

/** エラーコード → HTTPステータス（第13章の表と一致させる） */
export const ERROR_HTTP_STATUS: Record<MerchantApiErrorCode, number> = {
  invalid_request: 400,
  amount_mismatch: 400,
  event_date_out_of_range: 400,
  return_url_not_allowed: 400,
  signature_invalid: 401,
  merchant_suspended: 403,
  payment_not_found: 404,
  order_id_conflict: 409,
  session_expired: 410,
  limit_exceeded: 422,
  rate_limited: 429,
  internal_error: 500,
  service_unavailable: 503,
};

/** 加盟店APIで返すエラー本文 */
export interface MerchantApiErrorBody {
  error: {
    code: MerchantApiErrorCode;
    message: string;
    detail?: Record<string, unknown>;
  };
}

/**
 * 加盟店API の業務エラー。Route Handler で捕捉して仕様どおりの本文に変換する。
 */
export class MerchantApiError extends Error {
  readonly code: MerchantApiErrorCode;
  readonly detail?: Record<string, unknown>;

  /**
   * @param code - 接続仕様書のエラーコード
   * @param message - 加盟店の開発者向けメッセージ（購入者向けではない）
   * @param detail - 補足情報（例: max_event_date）
   */
  constructor(code: MerchantApiErrorCode, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = "MerchantApiError";
    this.code = code;
    this.detail = detail;
  }

  /** HTTP ステータスコード */
  get status(): number {
    return ERROR_HTTP_STATUS[this.code];
  }

  /** 仕様どおりのエラー本文 */
  toBody(): MerchantApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.detail ? { detail: this.detail } : {}),
      },
    };
  }
}

/**
 * 任意の例外を加盟店APIのエラーに正規化する。想定外の例外は internal_error にし、
 * 内部情報（スタック・SQL等）を外部へ出さない。
 */
export function toMerchantApiError(e: unknown): MerchantApiError {
  if (e instanceof MerchantApiError) return e;
  return new MerchantApiError(
    "internal_error",
    "当社側で処理を完了できませんでした。同じ注文IDで再実行してください"
  );
}
