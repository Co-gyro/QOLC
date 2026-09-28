/**
 * 加盟店API の Route Handler 共通処理（認証・エラー応答）
 */
import { NextResponse, type NextRequest } from "next/server";
import type { MerchantApiDeps } from "./deps";
import { MerchantApiError, toMerchantApiError } from "./errors";
import { verifyRequestSignature } from "./signature";
import type { CredentialRow } from "./types";

/** 応答に付ける共通ヘッダ（キャッシュ禁止） */
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * 仕様どおりの JSON 応答を返す。
 */
export function merchantJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * 例外を仕様どおりのエラー応答に変換する。想定外の例外はサーバーログに残し、外部には出さない。
 */
export function merchantErrorResponse(e: unknown): NextResponse {
  if (!(e instanceof MerchantApiError)) {
    // eslint-disable-next-line no-console
    console.error("[merchant-api] unexpected error", e);
  }
  const err = toMerchantApiError(e);
  return NextResponse.json(err.toBody(), { status: err.status, headers: NO_STORE });
}

/** 認証済みリクエスト */
export interface AuthenticatedRequest {
  credential: CredentialRow;
  /** 署名検証に使った生のボディ（GET は空文字列） */
  rawBody: string;
}

/**
 * X-UD-Merchant-Id と X-UD-Signature を検証する（接続仕様書 第3章）。
 * 加盟店IDが存在しない・失効済み・署名不一致・時刻ずれは、区別せず signature_invalid とする
 * （どの条件で落ちたかを外部に教えない）。
 */
export async function authenticateMerchantRequest(
  req: NextRequest,
  deps: MerchantApiDeps
): Promise<AuthenticatedRequest> {
  const rawBody = req.method === "GET" ? "" : await req.text();
  const apiMerchantId = req.headers.get("x-ud-merchant-id");
  const invalid = new MerchantApiError("signature_invalid", "署名またはタイムスタンプが不正です");
  if (!apiMerchantId || !/^mch_(test|live)_[0-9A-Z]{16}$/.test(apiMerchantId)) throw invalid;

  const credential = await deps.store.findCredentialByApiId(apiMerchantId);
  if (!credential || credential.revoked_at) throw invalid;

  const result = verifyRequestSignature({
    header: req.headers.get("x-ud-signature"),
    body: rawBody,
    secrets: deps.secretsOf(credential),
    nowSec: Math.floor(deps.now().getTime() / 1000),
  });
  if (!result.ok) {
    await deps.store.audit({
      action: "merchant_signature_invalid",
      merchantPaymentId: null,
      request: { api_merchant_id: apiMerchantId, reason: result.reason, method: req.method, path: req.nextUrl.pathname },
      ipAddress: clientIp(req),
    });
    throw invalid;
  }
  return { credential, rawBody };
}

/**
 * ボディを JSON として読む（不正なら invalid_request）。
 */
export function parseJsonBody(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new MerchantApiError("invalid_request", "リクエストボディが JSON ではありません");
  }
}

/** 監査ログ用のクライアントIP */
export function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}
