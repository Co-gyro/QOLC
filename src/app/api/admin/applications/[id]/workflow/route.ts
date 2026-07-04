/**
 * POST /api/admin/applications/[id]/workflow
 *
 * 案件に紐づく申請工程（workflow_runs）をテンプレ `merchant_application`（13工程）
 * から起票する。ステップはテンプレからスナップショット（buildRunSteps）して
 * workflow_run_steps へ保存する（テンプレ変更が過去の記録を壊さない＝監査性）。
 * - admin のみ / created_by=操作 admin を記録
 * - 既に紐づく run がある場合は 409（多重起票防止）
 * - application_events に kind='workflow_started' を記録
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import { buildRunSteps } from "@/lib/workflow/utils";
import type { WorkflowTemplateStep } from "@/lib/workflow/types";
import { apiError, apiOk } from "@/types/api";

/** 起票に使うテンプレートコード（migration 030 でシード済み） */
const TEMPLATE_CODE = "merchant_application";

/** 申請工程を起票する */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // 案件の存在確認（担当者はそのまま run に引き継ぐ）
  const { data: app, error: appErr } = await admin
    .from("applications")
    .select("id, applicant_name, applicant_org, assignee_id")
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
  const application = app as {
    id: string;
    applicant_name: string | null;
    applicant_org: string | null;
    assignee_id: string | null;
  };

  // 多重起票防止（キャンセル済みでない run が既にあれば起票しない）
  const { data: existing, error: exErr } = await admin
    .from("workflow_runs")
    .select("id")
    .eq("application_id", params.id)
    .is("deleted_at", null)
    .neq("status", "canceled")
    .limit(1);
  if (exErr) {
    return NextResponse.json(
      apiError(
        `工程を確認できません（workflow テーブル未適用の可能性があります）: ${exErr.message}`,
        "DB"
      ),
      { status: 500 }
    );
  }
  if (existing && existing.length > 0) {
    return NextResponse.json(
      apiError("この案件の申請工程はすでに起票されています", "ALREADY_EXISTS"),
      { status: 409 }
    );
  }

  // テンプレート取得（merchant_application 13工程）
  const { data: tpl, error: tplErr } = await admin
    .from("workflow_templates")
    .select("id, code, name, steps")
    .eq("code", TEMPLATE_CODE)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (tplErr || !tpl) {
    return NextResponse.json(
      apiError(
        "工程テンプレート（merchant_application）が見つかりません。migration 030 の適用状況を確認してください",
        "TEMPLATE_NOT_FOUND"
      ),
      { status: 500 }
    );
  }
  const template = tpl as { id: string; code: string; name: string; steps: WorkflowTemplateStep[] };

  const title = `加盟店申請：${application.applicant_org ?? application.applicant_name ?? params.id.slice(0, 8)}`;
  const { data: run, error: runErr } = await admin
    .from("workflow_runs")
    .insert({
      template_id: template.id,
      template_code: template.code,
      title,
      status: "open",
      assignee_id: application.assignee_id,
      application_id: params.id,
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (runErr || !run) {
    return NextResponse.json(
      apiError(`工程の起票に失敗しました: ${runErr?.message ?? "unknown"}`, "DB"),
      { status: 500 }
    );
  }
  const runId = run.id as string;

  // テンプレステップをスナップショットして保存
  const steps = buildRunSteps({ steps: template.steps ?? [] });
  const { error: stepErr } = await admin
    .from("workflow_run_steps")
    .insert(steps.map((s) => ({ ...s, run_id: runId })));
  if (stepErr) {
    // ステップ作成に失敗した run は残さない（ソフトデリートで巻き戻し。
    // 残すと再起票時に多重起票チェックへ引っかかり 409 になってしまう）
    await admin
      .from("workflow_runs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", runId);
    return NextResponse.json(
      apiError(`工程ステップの作成に失敗しました: ${stepErr.message}`, "DB"),
      { status: 500 }
    );
  }

  // タイムラインへ記録（誰が・いつ・どの工程を起票したか）
  const { error: evErr } = await admin.from("application_events").insert({
    application_id: params.id,
    actor_id: auth.user.id,
    kind: "workflow_started",
    detail: { run_id: runId, template_code: template.code, title, step_count: steps.length },
  });
  if (evErr) {
    return NextResponse.json(apiError(`履歴の記録に失敗しました: ${evErr.message}`, "DB"), {
      status: 500,
    });
  }

  return NextResponse.json(apiOk({ runId, stepCount: steps.length }));
}
