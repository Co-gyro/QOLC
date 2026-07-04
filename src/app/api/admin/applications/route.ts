/**
 * GET  /api/admin/applications … 申請/相談の一覧（status / assignee / source でフィルタ可能）
 * POST /api/admin/applications … 案件の手動起票（電話・窓口受付をその場で記録する）
 *
 * - admin のみ（RLS で担保。認証チェックも実施）
 * - 取得は getSupabaseServerClient()（RLS 適用）。担当者名解決のみ admin client。
 * - 手動起票は作成者（actor_id）付きの created イベントを必ず記録する
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/applications/server";
import { toApplicationRow, type RawApplication } from "@/lib/applications/mappers";
import { apiError, apiOk } from "@/types/api";
import { ALL_STATUSES, ALL_SOURCES } from "@/lib/applications/labels";
import { adminApplicationCreateSchema } from "@/lib/applications/admin-intake";

const querySchema = z.object({
  status: z.enum(ALL_STATUSES as unknown as [string, ...string[]]).optional(),
  assignee: z.string().uuid().optional(),
  source: z.enum(ALL_SOURCES as unknown as [string, ...string[]]).optional(),
});

const SELECT_COLS =
  "id, source, status, priority, applicant_name, applicant_org, applicant_email, applicant_phone, message, payload, assignee_id, due_date, next_action, merchant_id, created_at, updated_at";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }

  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    status: sp.get("status") ?? undefined,
    assignee: sp.get("assignee") ?? undefined,
    source: sp.get("source") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }
  const { status, assignee, source } = parsed.data;

  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("applications")
    .select(SELECT_COLS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (assignee) query = query.eq("assignee_id", assignee);
  if (source) query = query.eq("source", source);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(apiError(`取得に失敗しました: ${error.message}`, "DB"), {
      status: 500,
    });
  }
  const raws = (data ?? []) as unknown as RawApplication[];

  // 担当者名を解決（profiles.display_name）。RLS を避けるため admin client。
  const nameOf = await buildAssigneeResolver(raws.map((r) => r.assignee_id));
  const rows = raws.map((r) => toApplicationRow(r, nameOf));

  return NextResponse.json(apiOk({ items: rows }));
}

/**
 * 案件を手動起票する（公開フォームを経由しない電話・窓口受付用）。
 * 作成された application と created イベント（via=manual, actor=操作 admin）を記録する。
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), { status: 400 });
  }
  const parsed = adminApplicationCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "入力検証エラー";
    return NextResponse.json(apiError(first, "VALIDATION_ERROR"), { status: 400 });
  }
  const v = parsed.data;

  const admin = getSupabaseAdminClient();
  const { data: created, error: insErr } = await admin
    .from("applications")
    .insert({
      source: v.source,
      status: "new",
      priority: "normal",
      applicant_name: v.applicant_name,
      applicant_org: v.applicant_org?.trim() || null,
      applicant_email: v.applicant_email?.trim() || null,
      applicant_phone: v.applicant_phone?.trim() || null,
      message: v.message,
      payload: {},
    })
    .select("id")
    .single();
  if (insErr || !created) {
    return NextResponse.json(
      apiError(`起票に失敗しました: ${insErr?.message ?? "unknown"}`, "DB"),
      { status: 500 }
    );
  }

  const { error: evErr } = await admin.from("application_events").insert({
    application_id: created.id as string,
    actor_id: auth.user.id,
    kind: "created",
    detail: { via: "manual", source: v.source },
  });
  if (evErr) {
    return NextResponse.json(apiError(`履歴の記録に失敗しました: ${evErr.message}`, "DB"), {
      status: 500,
    });
  }

  return NextResponse.json(apiOk({ id: created.id as string }));
}

/**
 * 与えられた担当者 ID 群の display_name を一括取得し、id→表示名 の解決関数を返す。
 */
async function buildAssigneeResolver(
  ids: Array<string | null>
): Promise<(id: string | null) => string | null> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return () => null;
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", unique);
  const map = new Map<string, string | null>();
  for (const p of (data ?? []) as Array<{ id: string; display_name: string | null }>) {
    map.set(p.id, p.display_name);
  }
  return (id: string | null) => (id ? map.get(id) ?? null : null);
}
