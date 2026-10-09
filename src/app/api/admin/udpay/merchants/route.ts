/**
 * GET /api/admin/udpay/merchants — UD Payment 加盟店の一覧（UD管理者のみ）
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { listUdpayMerchants } from "@/lib/udpay/prod/merchants";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  try {
    return NextResponse.json(apiOk(await listUdpayMerchants(getSupabaseAdminClient())));
  } catch (e) {
    return NextResponse.json(apiError(e instanceof Error ? e.message : "取得に失敗しました"), { status: 500 });
  }
}
