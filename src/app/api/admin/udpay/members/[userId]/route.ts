/**
 * PATCH /api/admin/udpay/members/[userId] — 承認権限の切り替え・利用停止（UD管理者のみ）
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isUuid, requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateMember } from "@/lib/udpay/prod/members-admin";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  merchantId: z.string().uuid(),
  isApprover: z.boolean().optional(),
  deactivate: z.literal(true).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  if (!isUuid(params.userId)) return NextResponse.json(apiError("利用者IDが不正です", "BAD_REQUEST"), { status: 400 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(apiError("入力内容が不正です", "VALIDATION_ERROR"), { status: 400 });
  const r = await updateMember(getSupabaseAdminClient(), parsed.data.merchantId, params.userId, parsed.data);
  return r.ok ? NextResponse.json(apiOk({})) : NextResponse.json(apiError(r.error ?? "更新に失敗しました"), { status: 500 });
}
