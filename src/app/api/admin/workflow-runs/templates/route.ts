/**
 * GET /api/admin/workflow-runs/templates
 *
 * 起票可能な（is_active な）ワークフローテンプレの一覧を返す。
 * 起票ダイアログの選択肢用。steps 本体は返さず件数のみ返す（ペイロード削減）。
 * - admin のみ（requireAdmin。RLS でも担保）
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/applications/server";
import { apiError, apiOk } from "@/types/api";
import type { WorkflowTemplateStep } from "@/lib/workflow/types";
import type { WorkflowTemplateOption } from "@/lib/portal/workflow-client";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workflow_templates")
    .select("id, code, name, description, category, steps")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("category")
    .order("code");
  if (error) {
    return NextResponse.json(apiError(`取得に失敗しました: ${error.message}`, "DB"), {
      status: 500,
    });
  }

  const items: WorkflowTemplateOption[] = (
    (data ?? []) as Array<{
      id: string;
      code: string;
      name: string;
      description: string | null;
      category: string | null;
      steps: WorkflowTemplateStep[] | null;
    }>
  ).map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    description: t.description,
    category: t.category,
    stepCount: (t.steps ?? []).length,
  }));

  return NextResponse.json(apiOk({ items }));
}
