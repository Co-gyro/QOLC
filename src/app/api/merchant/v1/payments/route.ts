/**
 * GET /api/merchant/v1/payments?order_id=...
 * GET /api/merchant/v1/payments?from=...&to=...&status=...&event_id=...&limit=...&cursor=...
 *
 * 加盟店向け決済API: 注文IDによる決済照会（第8章）と取引一覧（第9章・日次照合）。
 */
import type { NextRequest } from "next/server";
import { createMerchantApiDeps } from "@/lib/merchant-api/runtime";
import { authenticateMerchantRequest, merchantErrorResponse, merchantJson } from "@/lib/merchant-api/http";
import { getPaymentByOrderId, listPayments } from "@/lib/merchant-api/service-session";
import { MerchantApiError } from "@/lib/merchant-api/errors";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * order_id 指定なら単一の決済、それ以外は期間指定の一覧を返す。
 */
export async function GET(req: NextRequest) {
  try {
    const deps = createMerchantApiDeps();
    const { credential } = await authenticateMerchantRequest(req, deps);
    const sp = req.nextUrl.searchParams;
    const orderId = sp.get("order_id");
    if (orderId !== null) {
      if (!/^[A-Za-z0-9-]{1,64}$/.test(orderId)) {
        throw new MerchantApiError("invalid_request", "order_id は半角英数とハイフン、64文字以内です");
      }
      return merchantJson(await getPaymentByOrderId(deps, credential, orderId));
    }
    return merchantJson(
      await listPayments(deps, credential, {
        from: sp.get("from"),
        to: sp.get("to"),
        status: sp.get("status"),
        event_id: sp.get("event_id"),
        limit: sp.get("limit"),
        cursor: sp.get("cursor"),
      })
    );
  } catch (e) {
    return merchantErrorResponse(e);
  }
}
