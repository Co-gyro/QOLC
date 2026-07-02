/**
 * GET /api/admin/applications/assignees
 *
 * アサイン候補（role='admin' の profiles）を返す。
 * - admin のみ
 * - profiles の RLS を避けるため admin client で取得
 */
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/applications/server";
import { apiError, apiOk } from "@/types/api";
import type { AssigneeOption } from "@/lib/applications/types";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("role", "admin")
    .is("deleted_at", null)
    .order("display_name");
  if (error) {
    return NextResponse.json(apiError(`取得に失敗しました: ${error.message}`, "DB"), {
      status: 500,
    });
  }

  const items: AssigneeOption[] = (
    (data ?? []) as Array<{ id: string; display_name: string | null }>
  ).map((p) => ({ id: p.id, name: p.display_name?.trim() || "（名称未設定）" }));

  return NextResponse.json(apiOk({ items }));
}
