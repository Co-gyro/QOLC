/**
 * GET  /api/admin/merchants/[id]/services — 加盟店の契約・ライセンス一覧（利用中の人数つき）
 * POST /api/admin/merchants/[id]/services — 契約の追加・更新（同じサービスがあれば更新）
 * UD管理者のみ。変更は activity_logs に記録する。
 */
import { NextResponse, type NextRequest } from "next/server";
import { isUuid, requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/audit/activity-log";
import { listMerchantServices, saveMerchantService, serviceInputSchema, SERVICE_LABEL, STATUS_LABEL } from "@/lib/admin/merchant-services";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  if (!isUuid(params.id)) return NextResponse.json(apiError("加盟店IDが不正です", "BAD_REQUEST"), { status: 400 });
  return NextResponse.json(apiOk(await listMerchantServices(getSupabaseAdminClient(), params.id)));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  if (!isUuid(params.id)) return NextResponse.json(apiError("加盟店IDが不正です", "BAD_REQUEST"), { status: 400 });
  const parsed = serviceInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(apiError(parsed.error.issues[0]?.message ?? "入力内容が不正です", "VALIDATION_ERROR"), { status: 400 });
  const r = await saveMerchantService(getSupabaseAdminClient(), params.id, parsed.data, auth.user.id);
  if (!r.ok) return NextResponse.json(apiError(r.error, "SAVE_FAILED"), { status: 400 });
  await logActivity({
    actorId: auth.user.id,
    action: "merchant_service_save",
    targetType: "merchant",
    targetId: params.id,
    targetLabel: `${SERVICE_LABEL[parsed.data.service]}（${STATUS_LABEL[parsed.data.status]}）`,
    metadata: { ...parsed.data },
  });
  return NextResponse.json(apiOk({}));
}
