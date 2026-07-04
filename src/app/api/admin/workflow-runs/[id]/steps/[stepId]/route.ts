/**
 * PATCH /api/admin/workflow-runs/[id]/steps/[stepId]
 *
 * ステップの状態（todo|done|skipped）とメモを更新する。
 * - done/skipped: completed_by=操作者 / completed_at=now を必ず記録
 * - todo に戻す: completed_by / completed_at をクリア
 * - 全ステップが todo 以外になったら run を自動 done（completed_at 設定）
 * - done の run のステップを todo に戻したら run を open に戻す
 * - admin のみ（requireAdmin。RLS でも担保）
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import { apiError, apiOk } from "@/types/api";
import type { WorkflowRunStatus, WorkflowStepStatus } from "@/lib/workflow/types";
import {
  shouldAutoCompleteRun,
  stepCompletionFields,
} from "@/lib/portal/workflow-logic";
import { logActivity } from "@/lib/audit/activity-log";

const patchSchema = z
  .object({
    status: z.enum(["todo", "done", "skipped"]).optional(),
    note: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "更新項目がありません" });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; stepId: string } }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id) || !isUuid(params.stepId)) {
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

  const { data: runData, error: runErr } = await admin
    .from("workflow_runs")
    .select("id, title, status")
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
  const run = runData as { id: string; title: string; status: WorkflowRunStatus };

  const { data: stepData, error: stepErr } = await admin
    .from("workflow_run_steps")
    .select("id, title, status")
    .eq("id", params.stepId)
    .eq("run_id", params.id)
    .maybeSingle();
  if (stepErr) {
    return NextResponse.json(apiError(`取得に失敗しました: ${stepErr.message}`, "DB"), {
      status: 500,
    });
  }
  if (!stepData) {
    return NextResponse.json(apiError("ステップが見つかりません", "NOT_FOUND"), { status: 404 });
  }
  const step = stepData as { id: string; title: string; status: WorkflowStepStatus };

  const updates: Record<string, string | null> = {};
  if (patch.status !== undefined && patch.status !== step.status) {
    // done/skipped は「誰が・いつ」を必ず記録し、todo に戻したらクリアする
    const fields = stepCompletionFields(patch.status, auth.user.id, new Date().toISOString());
    updates.status = fields.status;
    updates.completed_by = fields.completed_by;
    updates.completed_at = fields.completed_at;
  }
  if (patch.note !== undefined) {
    updates.note = patch.note === "" ? null : patch.note;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(apiError("変更内容がありません", "NO_CHANGE"), { status: 400 });
  }

  const { error: updErr } = await admin
    .from("workflow_run_steps")
    .update(updates)
    .eq("id", params.stepId);
  if (updErr) {
    return NextResponse.json(apiError(`更新に失敗しました: ${updErr.message}`, "DB"), {
      status: 500,
    });
  }

  // ステップ更新後の全状態から run の自動完了/再開を判定
  const { data: allSteps, error: allErr } = await admin
    .from("workflow_run_steps")
    .select("status")
    .eq("run_id", params.id);
  if (allErr) {
    return NextResponse.json(apiError(`進捗の取得に失敗しました: ${allErr.message}`, "DB"), {
      status: 500,
    });
  }
  const statuses = ((allSteps ?? []) as Array<{ status: WorkflowStepStatus }>).map(
    (s) => s.status
  );

  let runStatus: WorkflowRunStatus = run.status;
  let autoCompleted = false;
  if (run.status === "open" && shouldAutoCompleteRun(statuses)) {
    // 全ステップ消化 → run を自動完了
    const { error } = await admin
      .from("workflow_runs")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", params.id);
    if (!error) {
      runStatus = "done";
      autoCompleted = true;
      await logActivity({
        actorId: auth.user.id,
        action: "workflow_run_status_change",
        targetType: "workflow_run",
        targetId: params.id,
        targetLabel: run.title,
        metadata: { changes: { status: { from: "open", to: "done" } }, auto: true },
      });
    }
  } else if (run.status === "done" && !shouldAutoCompleteRun(statuses)) {
    // 完了済み run のステップを todo に戻した → run を進行中に戻す
    const { error } = await admin
      .from("workflow_runs")
      .update({ status: "open", completed_at: null })
      .eq("id", params.id);
    if (!error) {
      runStatus = "open";
      await logActivity({
        actorId: auth.user.id,
        action: "workflow_run_status_change",
        targetType: "workflow_run",
        targetId: params.id,
        targetLabel: run.title,
        metadata: { changes: { status: { from: "done", to: "open" } }, auto: true },
      });
    }
  }

  // ステップ操作自体の監査記録（誰が・どのステップを・どう変えたか）
  await logActivity({
    actorId: auth.user.id,
    action: "workflow_step_update",
    targetType: "workflow_run_step",
    targetId: params.stepId,
    targetLabel: `${run.title} / ${step.title}`,
    metadata: {
      run_id: params.id,
      ...(patch.status !== undefined ? { status: { from: step.status, to: patch.status } } : {}),
      ...(patch.note !== undefined ? { note_updated: true } : {}),
    },
  });

  return NextResponse.json(apiOk({ stepId: params.stepId, runStatus, autoCompleted }));
}
