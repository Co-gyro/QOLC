/**
 * GET   /api/admin/workflow-runs/[id]  … run 詳細（steps 込み・担当者/完了者名を解決）
 * PATCH /api/admin/workflow-runs/[id]  … title/assignee/due_date/note/status を更新
 *
 * - admin のみ（requireAdmin。RLS でも担保）
 * - status 変更は activity_logs へ監査記録（from/to・操作者）
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import { apiError, apiOk } from "@/types/api";
import type { WorkflowRunStatus, WorkflowStepStatus } from "@/lib/workflow/types";
import { computeRunProgress } from "@/lib/portal/workflow-logic";
import type { WorkflowRunDetail, WorkflowStepItem } from "@/lib/portal/workflow-client";
import { logActivity } from "@/lib/audit/activity-log";
import { buildNameResolver } from "../names";

const RUN_COLS =
  "id, template_code, title, status, assignee_id, application_id, merchant_id, due_date, note, created_by, created_at, completed_at, workflow_templates(name, category)";

interface RawRun {
  id: string;
  template_code: string;
  title: string;
  status: WorkflowRunStatus;
  assignee_id: string | null;
  application_id: string | null;
  merchant_id: string | null;
  due_date: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  workflow_templates: { name: string | null; category: string | null } | null;
}

interface RawStep {
  id: string;
  seq: number;
  title: string;
  guide: string | null;
  external_url: string | null;
  external_label: string | null;
  status: WorkflowStepStatus;
  completed_by: string | null;
  completed_at: string | null;
  note: string | null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: runData, error: runErr } = await supabase
    .from("workflow_runs")
    .select(RUN_COLS)
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (runErr) {
    return NextResponse.json(apiError(`取得に失敗しました: ${runErr.message}`, "DB"), {
      status: 500,
    });
  }
  if (!runData) {
    return NextResponse.json(apiError("タスクが見つかりません", "NOT_FOUND"), { status: 404 });
  }
  const raw = runData as unknown as RawRun;

  const { data: stepData, error: stepErr } = await supabase
    .from("workflow_run_steps")
    .select("id, seq, title, guide, external_url, external_label, status, completed_by, completed_at, note")
    .eq("run_id", params.id)
    .order("seq", { ascending: true });
  if (stepErr) {
    return NextResponse.json(apiError(`ステップの取得に失敗しました: ${stepErr.message}`, "DB"), {
      status: 500,
    });
  }
  const rawSteps = (stepData ?? []) as unknown as RawStep[];

  const nameOf = await buildNameResolver([
    raw.assignee_id,
    raw.created_by,
    ...rawSteps.map((s) => s.completed_by),
  ]);

  const steps: WorkflowStepItem[] = rawSteps.map((s) => ({
    id: s.id,
    seq: s.seq,
    title: s.title,
    guide: s.guide,
    externalUrl: s.external_url,
    externalLabel: s.external_label,
    status: s.status,
    completedBy: s.completed_by,
    completedByName: nameOf(s.completed_by),
    completedAt: s.completed_at,
    note: s.note,
  }));

  const detail: WorkflowRunDetail = {
    id: raw.id,
    templateCode: raw.template_code,
    templateName: raw.workflow_templates?.name ?? null,
    category: raw.workflow_templates?.category ?? null,
    title: raw.title,
    status: raw.status,
    assigneeId: raw.assignee_id,
    assigneeName: nameOf(raw.assignee_id),
    dueDate: raw.due_date,
    note: raw.note,
    applicationId: raw.application_id,
    merchantId: raw.merchant_id,
    createdByName: nameOf(raw.created_by),
    createdAt: raw.created_at,
    completedAt: raw.completed_at,
    progress: computeRunProgress(steps.map((s) => s.status)),
    steps,
  };
  return NextResponse.json(apiOk(detail));
}

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "日付は YYYY-MM-DD 形式で入力してください")
      .nullable()
      .optional(),
    note: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(["open", "done", "canceled"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "更新項目がありません" });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }
  const patch = parsed.data;

  const admin = getSupabaseAdminClient();
  const { data: before, error: beforeErr } = await admin
    .from("workflow_runs")
    .select("title, status, assignee_id, due_date, note")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (beforeErr) {
    return NextResponse.json(apiError(`取得に失敗しました: ${beforeErr.message}`, "DB"), {
      status: 500,
    });
  }
  if (!before) {
    return NextResponse.json(apiError("タスクが見つかりません", "NOT_FOUND"), { status: 404 });
  }
  const prev = before as {
    title: string;
    status: WorkflowRunStatus;
    assignee_id: string | null;
    due_date: string | null;
    note: string | null;
  };

  const updates: Record<string, string | null> = {};
  const changes: Record<string, { from: string | null; to: string | null }> = {};
  const norm = (v: string | null | undefined): string | null =>
    v === undefined ? null : v === "" ? null : v;

  if (patch.title !== undefined && patch.title !== prev.title) {
    updates.title = patch.title;
    changes.title = { from: prev.title, to: patch.title };
  }
  if (patch.assignee_id !== undefined && norm(patch.assignee_id) !== prev.assignee_id) {
    updates.assignee_id = norm(patch.assignee_id);
    changes.assignee_id = { from: prev.assignee_id, to: norm(patch.assignee_id) };
  }
  if (patch.due_date !== undefined && norm(patch.due_date) !== prev.due_date) {
    updates.due_date = norm(patch.due_date);
    changes.due_date = { from: prev.due_date, to: norm(patch.due_date) };
  }
  if (patch.note !== undefined && norm(patch.note) !== prev.note) {
    updates.note = norm(patch.note);
    changes.note = { from: prev.note, to: norm(patch.note) };
  }
  if (patch.status !== undefined && patch.status !== prev.status) {
    updates.status = patch.status;
    // 完了へ変更したら完了日時を記録。進行中へ戻したらクリア（中止は完了扱いにしない）
    updates.completed_at = patch.status === "done" ? new Date().toISOString() : null;
    changes.status = { from: prev.status, to: patch.status };
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(apiError("変更内容がありません", "NO_CHANGE"), { status: 400 });
  }

  const { error: updErr } = await admin
    .from("workflow_runs")
    .update(updates)
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json(apiError(`更新に失敗しました: ${updErr.message}`, "DB"), {
      status: 500,
    });
  }

  // 監査記録: 状態変更は専用アクションで、それ以外は更新内容つきで記録
  await logActivity({
    actorId: auth.user.id,
    action: changes.status ? "workflow_run_status_change" : "workflow_run_update",
    targetType: "workflow_run",
    targetId: params.id,
    targetLabel: patch.title ?? prev.title,
    metadata: { changes },
  });

  return NextResponse.json(apiOk({ id: params.id, updated: Object.keys(updates) }));
}
