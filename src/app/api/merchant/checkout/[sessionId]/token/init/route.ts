/**
 * POST /api/merchant/checkout/{session_id}/token/init
 *
 * USEN の ec-payment-web-adapter-token が startPaymentProcess で呼ぶ加盟店サーバの口
 * （トークン式EC決済API仕様書 10.1.7）。USEN /i/token/init の応答をそのまま返す。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createMerchantApiDeps } from "@/lib/merchant-api/runtime";
import { clientIp } from "@/lib/merchant-api/http";
import { CheckoutError, checkoutTokenInit } from "@/lib/merchant-api/service-checkout";
import { readBody, rejectInvalidSession, tokenInitBodySchema } from "@/lib/merchant-api/checkout-http";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * 決済初期化。エラー時も SDK が扱える {result:"ng"} 形式で返し、画面側の
 * OnPaymentError から中断処理（/abort）へつなげる。
 */
export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const invalid = rejectInvalidSession(params.sessionId);
  if (invalid) return invalid;
  const body = await readBody(req, tokenInitBodySchema);
  if (!body) return NextResponse.json({ result: "ng", code: "05", message: "入力内容を確認してください" });
  try {
    const res = await checkoutTokenInit(createMerchantApiDeps(), params.sessionId, body, clientIp(req));
    return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof CheckoutError ? e.message : "お手続きを完了できませんでした。";
    if (!(e instanceof CheckoutError)) {
      // eslint-disable-next-line no-console
      console.error("[merchant-checkout] token/init error", e);
    }
    return NextResponse.json({ result: "ng", code: "99", message });
  }
}
