/**
 * POST /api/merchant/v1/checkout/sessions
 *
 * 加盟店向け決済API: 決済セッションの作成（接続仕様書 v1.0 第6章）。
 * 同じ order_id の再送は新たな決済を作らず 200 で既存のセッションを返す。
 */
import type { NextRequest } from "next/server";
import { createMerchantApiDeps } from "@/lib/merchant-api/runtime";
import {
  authenticateMerchantRequest,
  clientIp,
  merchantErrorResponse,
  merchantJson,
  parseJsonBody,
} from "@/lib/merchant-api/http";
import { createCheckoutSession } from "@/lib/merchant-api/service-session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * 決済セッションを作成する。
 */
export async function POST(req: NextRequest) {
  try {
    const deps = createMerchantApiDeps();
    const { credential, rawBody } = await authenticateMerchantRequest(req, deps);
    const result = await createCheckoutSession(deps, credential, parseJsonBody(rawBody), clientIp(req));
    return merchantJson(result.body, result.httpStatus);
  } catch (e) {
    return merchantErrorResponse(e);
  }
}
