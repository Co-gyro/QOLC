/**
 * GET /api/merchant/v1/payments/{payment_id}
 *
 * 加盟店向け決済API: 決済照会（接続仕様書 v1.0 第8章）。発券を確定させる唯一の情報源。
 */
import type { NextRequest } from "next/server";
import { createMerchantApiDeps } from "@/lib/merchant-api/runtime";
import { authenticateMerchantRequest, merchantErrorResponse, merchantJson } from "@/lib/merchant-api/http";
import { getPaymentById } from "@/lib/merchant-api/service-session";
import { isPaymentId } from "@/lib/merchant-api/ids";
import { MerchantApiError } from "@/lib/merchant-api/errors";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * payment_id で決済を照会する。
 */
export async function GET(req: NextRequest, { params }: { params: { paymentId: string } }) {
  try {
    const deps = createMerchantApiDeps();
    const { credential } = await authenticateMerchantRequest(req, deps);
    if (!isPaymentId(params.paymentId)) {
      throw new MerchantApiError("payment_not_found", "該当する決済がありません");
    }
    return merchantJson(await getPaymentById(deps, credential, params.paymentId));
  } catch (e) {
    return merchantErrorResponse(e);
  }
}
