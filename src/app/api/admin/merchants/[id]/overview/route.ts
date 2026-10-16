/**
 * GET /api/admin/merchants/[id]/overview — 加盟店カルテの概要（基本情報・利用サービス・接続情報）。UD管理者のみ
 */
import { NextResponse } from "next/server";
import { isUuid, requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadMerchantOverview } from "@/lib/admin/merchant-overview";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  if (!isUuid(params.id)) return NextResponse.json(apiError("加盟店IDが不正です", "BAD_REQUEST"), { status: 400 });
  const overview = await loadMerchantOverview(getSupabaseAdminClient(), params.id);
  if (!overview) return NextResponse.json(apiError("加盟店が見つかりません", "NOT_FOUND"), { status: 404 });
  return NextResponse.json(apiOk(overview));
}
