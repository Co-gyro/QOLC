/**
 * 決済関連の例外型
 */

/** HMACキーの読み込み・検証エラー */
export class HmacKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HmacKeyError";
  }
}

/** USEN PSP API 呼び出しエラー（ネットワーク・パース・ビジネスエラー全般） */
export class UsenApiError extends Error {
  /** USEN が返したエラーコード（あれば） */
  readonly errorCode?: string;
  /** USEN レスポンス本文（あれば、機密情報マスク済み） */
  readonly responseBody?: unknown;
  /** HTTP ステータス */
  readonly httpStatus?: number;

  constructor(
    message: string,
    options: {
      errorCode?: string;
      responseBody?: unknown;
      httpStatus?: number;
    } = {}
  ) {
    super(message);
    this.name = "UsenApiError";
    this.errorCode = options.errorCode;
    this.responseBody = options.responseBody;
    this.httpStatus = options.httpStatus;
  }
}

/** 決済処理のビジネスエラー（バッチに対する論理エラー） */
export class PaymentServiceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PaymentServiceError";
    this.code = code;
  }
}
