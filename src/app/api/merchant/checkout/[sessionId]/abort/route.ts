/**
 * POST /api/merchant/checkout/{session_id}/abort
 *
 * 決済画面で SDK の OnPaymentError が発生したときに呼ぶ。本人認証の失敗は failed として
 * 加盟店へ戻し、通信エラー等は受注コードを新しくして入力し直してもらう。
 */
import type { NextRequest } from "next/server";
import { createMerchantApiDeps } from "@/lib/merchant-api/runtime";
import { checkoutAbort } from "@/lib/merchant-api/service-checkout";
import {
  abortBodySchema,
  badRequest,
  checkoutErrorResponse,
  outcomeResponse,
  readBody,
  rejectInvalidSession,
} from "@/lib/merchant-api/checkout-http";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * 決済画面のエラーを処理する。
 */
export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const invalid = rejectInvalidSession(params.sessionId);
  if (invalid) return invalid;
  const body = await readBody(req, abortBodySchema);
  if (!body) return badRequest();
  try {
    return outcomeResponse(await checkoutAbort(createMerchantApiDeps(), params.sessionId, body));
  } catch (e) {
    return checkoutErrorResponse(e);
  }
}
