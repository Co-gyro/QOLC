/**
 * GET /api/cron/merchant-api … 加盟店向け決済APIの定期処理（Vercel Cron から毎分）
 *
 * - 期限（expires_at＋猶予）を過ぎた未完了の決済を確定させる（USEN照会のうえ expired / succeeded）
 * - 決済結果通知の送信と再送（接続仕様書 第10章）
 * - 認証: Authorization: Bearer ${CRON_SECRET}（環境変数未設定時は 403）
 */
import { NextResponse, type NextRequest } from "next/server";
import { apiError, apiOk } from "@/types/api";
import { createMerchantApiDeps } from "@/lib/merchant-api/runtime";
import { expireDuePayments } from "@/lib/merchant-api/service-state";
import { deliverDueWebhooks } from "@/lib/merchant-api/webhook";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
// 通知は1件10秒で打ち切り、並列に送る
export const maxDuration = 60;

/**
 * 期限切れの確定と通知の送信を行う。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(apiError("認可されていません", "FORBIDDEN"), { status: 403 });
  }
  const deps = createMerchantApiDeps();
  const expired = await expireDuePayments(deps, 100);
  const webhooks = await deliverDueWebhooks(deps, 20);
  return NextResponse.json(apiOk({ expired, webhooks }));
}
