/**
 * GET /api/cron/daily … 定期起票（Vercel Cron から毎日 0:00 UTC = JST 9:00 に呼ばれる）
 *
 * - 認証: Authorization: Bearer ${CRON_SECRET}（環境変数未設定時は 403）
 * - enabled な recurring_rules を走査し、
 *   monthly → JST 今日の日 == day_of_month かつ last_run_on ≠ 今日なら起票
 *   daily   → last_run_on ≠ 今日なら起票
 * - title_pattern を formatTitlePattern で展開、default_assignee を担当者に設定
 * - 起票後に last_run_on を更新（同日の多重起票防止）
 * - DB は service_role クライアント（Cron はユーザーセッションを持たない）
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";
import {
  buildRunSteps,
  formatTitlePattern,
  getJstDateParts,
} from "@/lib/workflow/utils";
import type { RecurringRule, WorkflowTemplateStep } from "@/lib/workflow/types";
import { shouldTriggerRule, toJstDateString } from "@/lib/portal/workflow-logic";
import { rulesDueOn, buildOpsTaskRow } from "@/lib/ops-tasks/logic";
import { logActivity } from "@/lib/audit/activity-log";

export const dynamic = "force-dynamic";
// Next.js 14 では force-dynamic だけでは fetch データキャッシュが残り、
// recurring_rules の古い last_run_on を読んで多重起票する（本番で実測）。
export const fetchCache = "force-no-store";

/** 起票結果1件（運用確認用の戻り JSON に含める） */
interface CreatedRun {
  rule: string;
  runId: string;
  title: string;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(apiError("認可されていません", "FORBIDDEN"), { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const today = getJstDateParts();
  const todayStr = toJstDateString(today);

  const { data, error } = await admin
    .from("recurring_rules")
    .select("id, code, name, template_code, cadence, day_of_month, title_pattern, enabled, default_assignee, last_run_on")
    .eq("enabled", true)
    .is("deleted_at", null);
  if (error) {
    return NextResponse.json(apiError(`ルールの取得に失敗しました: ${error.message}`, "DB"), {
      status: 500,
    });
  }
  const rules = (data ?? []) as unknown as RecurringRule[];

  const created: CreatedRun[] = [];
  const errors: Array<{ rule: string; message: string }> = [];
  let skipped = 0;

  for (const rule of rules) {
    if (!shouldTriggerRule(rule, today)) {
      skipped += 1;
      continue;
    }
    try {
      const runId = await createRunFromRule(rule, today);
      if (runId === null) {
        skipped += 1; // 先取りロックが取れなかった＝本日すでに起票済み
        continue;
      }
      created.push({
        rule: rule.code,
        runId,
        title: formatTitlePattern(rule.title_pattern, today),
      });
    } catch (e) {
      errors.push({ rule: rule.code, message: e instanceof Error ? e.message : String(e) });
    }
  }

  // その他業務（ops_tasks）の定例起票。
  // recurring_key + period の UNIQUE 制約が多重起票を防ぐ（重複エラーはスキップ扱い）。
  // migration 033 未適用の DB でも Cron 全体は失敗させない。
  const opsCreated: string[] = [];
  for (const rule of rulesDueOn(today)) {
    const row = buildOpsTaskRow(rule, today);
    const { error: insErr } = await admin.from("ops_tasks").insert(row);
    if (!insErr) {
      opsCreated.push(rule.key);
    } else if (insErr.code !== "23505" && !/does not exist/.test(insErr.message)) {
      errors.push({ rule: `ops:${rule.key}`, message: insErr.message });
    }
  }

  return NextResponse.json(apiOk({ date: todayStr, created, skipped, errors, opsCreated }));
}

/**
 * ルール1件から run + steps を起票し、last_run_on を更新して run の id を返す。
 * @param rule 起票対象の recurring_rules 行
 * @param today JST の今日（getJstDateParts の結果）
 */
async function createRunFromRule(
  rule: RecurringRule,
  today: ReturnType<typeof getJstDateParts>
): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const todayStr = toJstDateString(today);

  // 先取りロック: last_run_on が今日でない行だけを今日に更新できたときのみ起票する。
  // 条件付き UPDATE を DB 側で原子的に行うため、キャッシュされた古い読み取りや
  // Cron の同時実行があっても同日の多重起票は起きない。
  const { data: claimed, error: claimErr } = await admin
    .from("recurring_rules")
    .update({ last_run_on: todayStr })
    .eq("id", rule.id)
    .or(`last_run_on.is.null,last_run_on.neq.${todayStr}`)
    .select("id");
  if (claimErr) throw new Error(`last_run_on の更新に失敗: ${claimErr.message}`);
  if (!claimed || claimed.length === 0) {
    return null; // 既に本日起票済み（別インスタンスが先行）
  }

  try {
    return await createClaimedRun(rule, today);
  } catch (e) {
    // 起票に失敗した場合はロックを元に戻し、次回の Cron で再試行できるようにする
    await admin
      .from("recurring_rules")
      .update({ last_run_on: rule.last_run_on })
      .eq("id", rule.id);
    throw e;
  }
}

/**
 * 先取りロック取得済みのルールから run + steps を作成する（createRunFromRule 専用）。
 * @param rule 起票対象の recurring_rules 行
 * @param today JST の今日（getJstDateParts の結果）
 */
async function createClaimedRun(
  rule: RecurringRule,
  today: ReturnType<typeof getJstDateParts>
): Promise<string> {
  const admin = getSupabaseAdminClient();

  const { data: tmpl, error: tmplErr } = await admin
    .from("workflow_templates")
    .select("id, code, name, steps")
    .eq("code", rule.template_code)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (tmplErr) throw new Error(`テンプレの取得に失敗: ${tmplErr.message}`);
  if (!tmpl) throw new Error(`テンプレが見つかりません: ${rule.template_code}`);
  const template = tmpl as { id: string; code: string; name: string; steps: WorkflowTemplateStep[] };

  const title = formatTitlePattern(rule.title_pattern, today);
  const steps = buildRunSteps({ steps: template.steps ?? [] });

  const { data: run, error: runErr } = await admin
    .from("workflow_runs")
    .insert({
      template_id: template.id,
      template_code: template.code,
      title,
      status: "open",
      assignee_id: rule.default_assignee,
      created_by: null, // NULL = Cron による自動起票
    })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(`起票に失敗: ${runErr?.message ?? "unknown"}`);
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
    throw new Error(`ステップの作成に失敗: ${stepErr.message}`);
  }

  await logActivity({
    actorId: null,
    actorName: "定期起票（自動）",
    actorRole: "system",
    action: "workflow_run_create",
    targetType: "workflow_run",
    targetId: runId,
    targetLabel: title,
    metadata: { rule: rule.code, template_code: template.code, auto: true },
  });

  return runId;
}
