/**
 * POST /api/merchant/checkout/{session_id}/pay
 *
 * 3Dセキュア完了（OnPaymentStart）後に決済画面から呼ぶ。USEN /i/pay を実行し、
 * 取引照会で確定させたうえで、加盟店の return_url（署名付き）を返す。
 */
import type { NextRequest } from "next/server";
import { createMerchantApiDeps } from "@/lib/merchant-api/runtime";
import { clientIp } from "@/lib/merchant-api/http";
import { checkoutPay } from "@/lib/merchant-api/service-checkout";
import {
  badRequest,
  checkoutErrorResponse,
  outcomeResponse,
  payBodySchema,
  readBody,
  rejectInvalidSession,
} from "@/lib/merchant-api/checkout-http";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
// USEN /i/pay（最大30秒）＋取引照会を待つ
export const maxDuration = 60;

/**
 * 決済を実行する。
 */
export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const invalid = rejectInvalidSession(params.sessionId);
  if (invalid) return invalid;
  const body = await readBody(req, payBodySchema);
  if (!body) return badRequest();
  try {
    return outcomeResponse(await checkoutPay(createMerchantApiDeps(), params.sessionId, body, clientIp(req)));
  } catch (e) {
    return checkoutErrorResponse(e);
  }
}
