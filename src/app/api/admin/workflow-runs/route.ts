/**
 * GET  /api/admin/workflow-runs … 業務タスク（run）一覧（進捗 done数/全step数 込み）
 * POST /api/admin/workflow-runs … テンプレから手動起票
 *
 * - admin のみ（requireAdmin。RLS でも担保）
 * - 起票時はテンプレの steps をスナップショットして workflow_run_steps に複製する
 *   （テンプレ変更が過去の記録を壊さない＝監査性）
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/applications/server";
import { apiError, apiOk } from "@/types/api";
import { buildRunSteps, getJstDateParts } from "@/lib/workflow/utils";
import type { WorkflowRunStatus, WorkflowStepStatus, WorkflowTemplateStep } from "@/lib/workflow/types";
import { computeRunProgress, defaultRunTitle } from "@/lib/portal/workflow-logic";
import type { WorkflowRunListItem } from "@/lib/portal/workflow-client";
import { logActivity } from "@/lib/audit/activity-log";
import { buildNameResolver } from "./names";

const querySchema = z.object({
  status: z.enum(["open", "done", "canceled"]).optional(),
  assignee: z.string().uuid().optional(),
  template_code: z.string().max(100).optional(),
});

const RUN_COLS =
  "id, template_code, title, status, assignee_id, due_date, created_at, completed_at, workflow_templates(name, category)";

interface RawRun {
  id: string;
  template_code: string;
  title: string;
  status: WorkflowRunStatus;
  assignee_id: string | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  workflow_templates: { name: string | null; category: string | null } | null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }

  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    status: sp.get("status") ?? undefined,
    assignee: sp.get("assignee") ?? undefined,
    template_code: sp.get("template_code") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }
  const { status, assignee, template_code } = parsed.data;

  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("workflow_runs")
    .select(RUN_COLS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (status) query = query.eq("status", status);
  if (assignee) query = query.eq("assignee_id", assignee);
  if (template_code) query = query.eq("template_code", template_code);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(apiError(`取得に失敗しました: ${error.message}`, "DB"), {
      status: 500,
    });
  }
  const raws = (data ?? []) as unknown as RawRun[];

  // 進捗（done数/全step数）: 対象 run のステップ状態をまとめて取得して集計
  const statusesByRun = new Map<string, WorkflowStepStatus[]>();
  if (raws.length > 0) {
    const { data: stepData, error: stepErr } = await supabase
      .from("workflow_run_steps")
      .select("run_id, status")
      .in("run_id", raws.map((r) => r.id));
    if (stepErr) {
      return NextResponse.json(apiError(`進捗の取得に失敗しました: ${stepErr.message}`, "DB"), {
        status: 500,
      });
    }
    for (const s of (stepData ?? []) as Array<{ run_id: string; status: WorkflowStepStatus }>) {
      const arr = statusesByRun.get(s.run_id) ?? [];
      arr.push(s.status);
      statusesByRun.set(s.run_id, arr);
    }
  }

  const nameOf = await buildNameResolver(raws.map((r) => r.assignee_id));
  const items: WorkflowRunListItem[] = raws.map((r) => ({
    id: r.id,
    templateCode: r.template_code,
    templateName: r.workflow_templates?.name ?? null,
    category: r.workflow_templates?.category ?? null,
    title: r.title,
    status: r.status,
    assigneeId: r.assignee_id,
    assigneeName: nameOf(r.assignee_id),
    dueDate: r.due_date,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    progress: computeRunProgress(statusesByRun.get(r.id) ?? []),
  }));

  return NextResponse.json(apiOk({ items }));
}

const postSchema = z.object({
  template_code: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日付は YYYY-MM-DD 形式で入力してください")
    .nullable()
    .optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  application_id: z.string().uuid().nullable().optional(),
  merchant_id: z.string().uuid().nullable().optional(),
});

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
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }
  const input = parsed.data;

  const admin = getSupabaseAdminClient();
  const { data: tmpl, error: tmplErr } = await admin
    .from("workflow_templates")
    .select("id, code, name, steps")
    .eq("code", input.template_code)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (tmplErr) {
    return NextResponse.json(apiError(`テンプレの取得に失敗しました: ${tmplErr.message}`, "DB"), {
      status: 500,
    });
  }
  if (!tmpl) {
    return NextResponse.json(apiError("テンプレートが見つかりません", "NOT_FOUND"), {
      status: 404,
    });
  }
  const template = tmpl as { id: string; code: string; name: string; steps: WorkflowTemplateStep[] };
  const steps = buildRunSteps({ steps: template.steps ?? [] });
  const title = input.title ?? defaultRunTitle(template.name, getJstDateParts());

  const { data: run, error: runErr } = await admin
    .from("workflow_runs")
    .insert({
      template_id: template.id,
      template_code: template.code,
      title,
      status: "open",
      assignee_id: input.assignee_id ?? null,
      application_id: input.application_id ?? null,
      merchant_id: input.merchant_id ?? null,
      due_date: input.due_date ?? null,
      note: input.note ?? null,
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (runErr || !run) {
    return NextResponse.json(
      apiError(`起票に失敗しました: ${runErr?.message ?? "unknown"}`, "DB"),
      { status: 500 }
    );
  }
  const runId = (run as { id: string }).id;

  const { error: stepErr } = await admin
    .from("workflow_run_steps")
    .insert(steps.map((s) => ({ ...s, run_id: runId })));
  if (stepErr) {
    // ステップ作成に失敗した run は残さない（ソフトデリートで巻き戻し）
    await admin
      .from("workflow_runs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", runId);
    return NextResponse.json(
      apiError(`ステップの作成に失敗しました: ${stepErr.message}`, "DB"),
      { status: 500 }
    );
  }

  await logActivity({
    actorId: auth.user.id,
    action: "workflow_run_create",
    targetType: "workflow_run",
    targetId: runId,
    targetLabel: title,
    metadata: { template_code: template.code, step_count: steps.length },
  });

  return NextResponse.json(apiOk({ id: runId, title }), { status: 201 });
}
