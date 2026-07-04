/**
 * 「今日のUD」ホーム（/admin/today）の集計クエリと純ヘルパー
 *
 * - ブラウザクライアント + RLS（admin ポリシー）で実行（dashboard-queries と同様式）
 * - workflow 系テーブルは migration 030 未適用の DB でも画面全体が落ちないよう、
 *   取得失敗時は空配列にフォールバックする（段階フォールバック原則）
 * - 集計・並べ替えは純関数に切り出してテスト可能にする
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  OPEN_STATUSES,
  SOURCE_LABELS,
  STATUS_LABELS,
  type ApplicationSource,
  type ApplicationStatus,
} from "@/lib/applications/labels";
import type { WorkflowStepStatus } from "@/lib/workflow/types";
import { computeRunProgress, isOverdue } from "./workflow-logic";

/** 「今日のUD」で扱う進行中 run の最小形 */
export interface TodayRun {
  id: string;
  title: string;
  dueDate: string | null;
  assigneeId: string | null;
  stepStatuses: WorkflowStepStatus[];
}

/**
 * 進行中（open）の workflow_runs をステップ状態つきで取得する。
 * テーブル未作成（migration 030 未適用）でも throw せず空配列を返す。
 */
export async function fetchOpenWorkflowRuns(): Promise<TodayRun[]> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("workflow_runs")
      .select("id, title, due_date, assignee_id, workflow_run_steps(status)")
      .eq("status", "open")
      .is("deleted_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      title: string;
      due_date: string | null;
      assignee_id: string | null;
      workflow_run_steps: Array<{ status: WorkflowStepStatus }> | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      dueDate: r.due_date,
      assigneeId: r.assignee_id,
      stepStatuses: (r.workflow_run_steps ?? []).map((s) => s.status),
    }));
  } catch {
    // workflow テーブル未適用の DB でも「今日のUD」全体を落とさない
    return [];
  }
}

/** 「今日のUD」で扱う申請/相談の最小形 */
export interface TodayApplication {
  id: string;
  source: ApplicationSource;
  status: ApplicationStatus;
  applicantName: string | null;
  applicantOrg: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  nextAction: string | null;
  createdAt: string;
}

/** 未完了（new/in_progress/waiting）の申請/相談を取得する */
export async function fetchOpenApplicationsToday(): Promise<TodayApplication[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, source, status, applicant_name, applicant_org, assignee_id, due_date, next_action, created_at"
    )
    .in("status", [...OPEN_STATUSES])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`申請の取得に失敗しました: ${error.message}`);
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    source: ApplicationSource;
    status: ApplicationStatus;
    applicant_name: string | null;
    applicant_org: string | null;
    assignee_id: string | null;
    due_date: string | null;
    next_action: string | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    status: r.status,
    applicantName: r.applicant_name,
    applicantOrg: r.applicant_org,
    assigneeId: r.assignee_id,
    dueDate: r.due_date,
    nextAction: r.next_action,
    createdAt: r.created_at,
  }));
}

/** 決済アラート件数（failed=失敗 / pending=保留） */
export interface PaymentAlertCounts {
  failed: number;
  pending: number;
}

/** 決済の失敗・保留の件数を取得する（count のみ） */
export async function fetchPaymentAlertCounts(): Promise<PaymentAlertCounts> {
  const supabase = createSupabaseBrowserClient();
  const countOf = async (status: string): Promise<number> => {
    const { count, error } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", status);
    if (error) throw new Error(`決済件数の取得に失敗しました: ${error.message}`);
    return count ?? 0;
  };
  const [failed, pending] = await Promise.all([countOf("failed"), countOf("pending")]);
  return { failed, pending };
}

// ============================================================
// 純ヘルパー（テスト対象）
// ============================================================

/** マイタスク1件（run と application を統合した表示用の形） */
export interface MyTaskItem {
  type: "run" | "application";
  id: string;
  title: string;
  href: string;
  dueDate: string | null;
  /** 補足表示（run: 進捗 n/m ／ application: 状態ラベル） */
  detail: string;
}

/** dueDate 昇順（null は最後）で比較 */
function compareDue(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/**
 * 自分担当の run + 申請を期限順（期限なしは最後）に統合する（マイタスク）。
 * @param runs 進行中 run（fetchOpenWorkflowRuns の結果）
 * @param apps 未完了の申請（fetchOpenApplicationsToday の結果）
 * @param userId ログイン中 admin の user.id
 */
export function buildMyTasks(
  runs: TodayRun[],
  apps: TodayApplication[],
  userId: string
): MyTaskItem[] {
  const runItems: MyTaskItem[] = runs
    .filter((r) => r.assigneeId === userId)
    .map((r) => {
      const p = computeRunProgress(r.stepStatuses);
      return {
        type: "run" as const,
        id: r.id,
        title: r.title,
        href: `/admin/tasks/${r.id}`,
        dueDate: r.dueDate,
        detail: `進捗 ${p.done + p.skipped}/${p.total}`,
      };
    });
  const appItems: MyTaskItem[] = apps
    .filter((a) => a.assigneeId === userId)
    .map((a) => ({
      type: "application" as const,
      id: a.id,
      title: `${SOURCE_LABELS[a.source]}: ${a.applicantName ?? a.applicantOrg ?? "（申請者不明）"}`,
      href: "/admin/applications",
      dueDate: a.dueDate,
      detail: a.nextAction ? `次: ${a.nextAction}` : STATUS_LABELS[a.status],
    }));
  return [...runItems, ...appItems].sort((x, y) => compareDue(x.dueDate, y.dueDate));
}

/** 期限超過（due_date < 今日）の進行中 run を抽出する */
export function selectOverdueRuns(runs: TodayRun[], todayStr: string): TodayRun[] {
  return runs.filter((r) => isOverdue(r.dueDate, todayStr));
}

/** チーム状況1行（担当者ごとの対応中件数） */
export interface TeamMemberStatus {
  id: string;
  name: string;
  applicationCount: number;
  runCount: number;
}

/** チーム状況の集計結果（担当者別 + 未割当） */
export interface TeamStatus {
  members: TeamMemberStatus[];
  unassigned: { applicationCount: number; runCount: number };
}

/**
 * admin 担当者ごとの「対応中の申請件数」「進行中タスク件数」を集計する
 * （＝誰が今なにをしているか）。担当者リストにない ID や未割当は unassigned に集約。
 */
export function buildTeamStatus(
  assignees: Array<{ id: string; name: string }>,
  apps: TodayApplication[],
  runs: TodayRun[]
): TeamStatus {
  const members: TeamMemberStatus[] = assignees.map((a) => ({
    id: a.id,
    name: a.name,
    applicationCount: apps.filter((x) => x.assigneeId === a.id).length,
    runCount: runs.filter((x) => x.assigneeId === a.id).length,
  }));
  const known = new Set(assignees.map((a) => a.id));
  const unassigned = {
    applicationCount: apps.filter((x) => !x.assigneeId || !known.has(x.assigneeId)).length,
    runCount: runs.filter((x) => !x.assigneeId || !known.has(x.assigneeId)).length,
  };
  return { members, unassigned };
}
