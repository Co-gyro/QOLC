/**
 * GET /api/admin/applications
 *
 * 申請/相談の一覧を返す。クエリ status / assignee / source でフィルタ可能。
 * - admin のみ（RLS で担保。認証チェックも実施）
 * - 取得は getSupabaseServerClient()（RLS 適用）。担当者名解決のみ admin client。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/applications/server";
import { toApplicationRow, type RawApplication } from "@/lib/applications/mappers";
import { apiError, apiOk } from "@/types/api";
import { ALL_STATUSES, ALL_SOURCES } from "@/lib/applications/labels";

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
