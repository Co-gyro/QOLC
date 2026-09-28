/**
 * 決済画面（購入者ブラウザ）から呼ばれる内部エンドポイントの共通処理
 *
 * 加盟店向けAPIとは別物で、署名ではなく推測不能な session_id で保護する。
 * 応答は QOLC 共通の apiOk / apiError 形式。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/types/api";
import { isSessionId } from "./ids";
import { CheckoutError, type CheckoutOutcome } from "./service-checkout";

/** SDK から /token/init に届く値 */
export const tokenInitBodySchema = z.object({
  jutyu_cd: z.string().regex(/^[A-Z0-9]{4}-\d{7}$/),
  token: z.string().min(1).max(8192),
  card_limit_yyyy: z.string().regex(/^\d{4}$/),
  card_limit_mm: z.string().regex(/^(0[1-9]|1[0-2])$/),
  cardholder_name: z.string().regex(/^[A-Za-z0-9]{2,45}$/), // 仕様: 半角英数2〜45桁
});

/** OnPaymentStart で受け取った値 */
export const payBodySchema = z.object({
  jutyu_cd: z.string().regex(/^[A-Z0-9]{4}-\d{7}$/),
  token: z.string().min(1).max(8192),
  check_cd: z.string().regex(/^HM[0-9a-f]{1,128}$/),
});

/** OnPaymentError の報告 */
export const abortBodySchema = z.object({
  jutyu_cd: z.string().regex(/^[A-Z0-9]{4}-\d{7}$/),
  error_type: z.enum(["NG_3DS_BRW_INIT", "NG_3DS_BRW_AUTH", "NETWORK", "UNEXPECTED", "INIT_NG"]),
  /** SDK が渡したエラー詳細の要約（調査用・監査ログにのみ残す） */
  detail: z.string().max(300).optional(),
});

/**
 * session_id の形式を確認する。不正なら 404 応答を返す。
 */
export function rejectInvalidSession(sessionId: string): NextResponse | null {
  if (isSessionId(sessionId)) return null;
  return NextResponse.json(apiError("お支払い画面が見つかりません", "NOT_FOUND"), { status: 404 });
}

/**
 * ボディを読み zod で検証する。不正なら null。
 */
export async function readBody<T>(req: Request, schema: z.ZodType<T>): Promise<T | null> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** 入力不正の応答 */
export function badRequest(): NextResponse {
  return NextResponse.json(apiError("入力内容を確認してください", "VALIDATION_ERROR"), { status: 400 });
}

/** 結果の応答 */
export function outcomeResponse(outcome: CheckoutOutcome): NextResponse {
  return NextResponse.json(apiOk(outcome), { headers: { "Cache-Control": "no-store" } });
}

/**
 * 例外を購入者向けの応答にする（内部情報は出さない）。
 */
export function checkoutErrorResponse(e: unknown): NextResponse {
  if (e instanceof CheckoutError) {
    return NextResponse.json(apiError(e.message, "CHECKOUT_ERROR"), { status: e.httpStatus });
  }
  // eslint-disable-next-line no-console
  console.error("[merchant-checkout] unexpected error", e);
  return NextResponse.json(
    apiError("お手続きを完了できませんでした。しばらくしてからお試しください。", "INTERNAL"),
    { status: 500 }
  );
}
