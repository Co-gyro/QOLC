/**
 * GET /api/admin/udpay/payments?merchantId= — 加盟店の決済一覧（UD管理者のみ。取消・返品の操作用）
 */
import { NextResponse, type NextRequest } from "next/server";
import { isUuid, requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { listAdminPayments } from "@/lib/udpay/prod/admin-payments";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  const merchantId = req.nextUrl.searchParams.get("merchantId") ?? "";
  if (!isUuid(merchantId)) return NextResponse.json(apiError("加盟店IDが不正です", "BAD_REQUEST"), { status: 400 });
  try {
    return NextResponse.json(apiOk(await listAdminPayments(getSupabaseAdminClient(), merchantId, new Date())));
  } catch (e) {
    return NextResponse.json(apiError(e instanceof Error ? e.message : "取得に失敗しました"), { status: 500 });
  }
}
