/**
 * POST /api/merchant/checkout/{session_id}/cancel
 *
 * 購入者が決済画面で「購入をやめる」を押したときに呼ぶ。cancelled にして cancel_url を返す。
 */
import type { NextRequest } from "next/server";
import { createMerchantApiDeps } from "@/lib/merchant-api/runtime";
import { checkoutCancel } from "@/lib/merchant-api/service-checkout";
import { checkoutErrorResponse, outcomeResponse, rejectInvalidSession } from "@/lib/merchant-api/checkout-http";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * 決済を中断する。
 */
export async function POST(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  const invalid = rejectInvalidSession(params.sessionId);
  if (invalid) return invalid;
  try {
    return outcomeResponse(await checkoutCancel(createMerchantApiDeps(), params.sessionId));
  } catch (e) {
    return checkoutErrorResponse(e);
  }
}
