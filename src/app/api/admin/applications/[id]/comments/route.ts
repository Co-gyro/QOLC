/**
 * POST /api/admin/applications/[id]/comments
 *
 * 対応メモ（電話・メール対応の履歴）を application_events に kind='comment' で記録する。
 * - admin のみ
 * - actor_id=操作した admin を必ず記録（誰が・いつ・何を、の可視化）
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import { apiError, apiOk } from "@/types/api";

const bodySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "メモの内容を入力してください")
    .max(2000, "メモは2000文字以内で入力してください"),
});

/** 対応メモを1件記録する */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "入力検証エラー";
    return NextResponse.json(apiError(first, "VALIDATION_ERROR"), { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: app, error: appErr } = await admin
    .from("applications")
    .select("id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (appErr) {
    return NextResponse.json(apiError(`取得に失敗しました: ${appErr.message}`, "DB"), {
      status: 500,
    });
  }
  if (!app) {
    return NextResponse.json(apiError("申請が見つかりません", "NOT_FOUND"), { status: 404 });
  }

  const { data: ev, error: evErr } = await admin
    .from("application_events")
    .insert({
      application_id: params.id,
      actor_id: auth.user.id,
      kind: "comment",
      detail: { text: parsed.data.text },
    })
    .select("id")
    .single();
  if (evErr || !ev) {
    return NextResponse.json(
      apiError(`メモの記録に失敗しました: ${evErr?.message ?? "unknown"}`, "DB"),
      { status: 500 }
    );
  }

  return NextResponse.json(apiOk({ id: ev.id as string }));
}
