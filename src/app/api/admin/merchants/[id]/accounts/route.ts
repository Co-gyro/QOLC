/**
 * GET /api/admin/merchants/[id]/accounts — 加盟店の利用者（提供者・UD Payment 利用者）一覧。UD管理者のみ
 */
import { NextResponse } from "next/server";
import { isUuid, requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { listMerchantAccounts } from "@/lib/admin/merchant-accounts";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  if (!isUuid(params.id)) return NextResponse.json(apiError("加盟店IDが不正です", "BAD_REQUEST"), { status: 400 });
  return NextResponse.json(apiOk(await listMerchantAccounts(getSupabaseAdminClient(), params.id)));
}
