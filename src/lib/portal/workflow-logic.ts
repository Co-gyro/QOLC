/**
 * ワークフロー run / step / 定期起票（Cron）の純ロジック（DBアクセスなし）
 *
 * API Route（/api/admin/workflow-runs, /api/cron/daily）と画面の両方から使う。
 * 日付は必ず引数で注入し、ユニットテスト可能な形に保つこと。
 */
import type {
  RecurringCadence,
  WorkflowStepStatus,
} from "@/lib/workflow/types";
import type { DateParts } from "@/lib/workflow/utils";

/** run の進捗（done=完了 / skipped=スキップ / total=全ステップ数） */
export interface RunProgress {
  done: number;
  skipped: number;
  total: number;
}

/**
 * ステップ状態の配列から進捗を集計する。
 * 進捗バーの「消化済み」は done + skipped（todo 以外）で数える。
 */
export function computeRunProgress(statuses: WorkflowStepStatus[]): RunProgress {
  let done = 0;
  let skipped = 0;
  for (const s of statuses) {
    if (s === "done") done += 1;
    if (s === "skipped") skipped += 1;
  }
  return { done, skipped, total: statuses.length };
}

/**
 * 全ステップが todo 以外（done か skipped）になったら run を自動完了させる判定。
 * ステップが0件の run は自動完了しない。
 */
export function shouldAutoCompleteRun(statuses: WorkflowStepStatus[]): boolean {
  return statuses.length > 0 && statuses.every((s) => s !== "todo");
}

/** ステップ状態変更時に更新する完了記録カラム（誰が・いつ） */
export interface StepCompletionFields {
  status: WorkflowStepStatus;
  completed_by: string | null;
  completed_at: string | null;
}

/**
 * ステップの状態変更に伴う完了記録（completed_by / completed_at）を組み立てる。
 * - done / skipped: 操作者と現在時刻を必ず記録（属人性の排除＝記録の可視化）
 * - todo に戻す: 両方クリア
 * @param status 変更後の状態
 * @param actorId 操作した admin の user.id
 * @param nowIso 現在時刻（ISO文字列。テストのため注入）
 */
export function stepCompletionFields(
  status: WorkflowStepStatus,
  actorId: string,
  nowIso: string
): StepCompletionFields {
  if (status === "todo") {
    return { status, completed_by: null, completed_at: null };
  }
  return { status, completed_by: actorId, completed_at: nowIso };
}

/** DateParts → "YYYY-MM-DD"（recurring_rules.last_run_on / date 比較用） */
export function toJstDateString(parts: DateParts): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${p(parts.month)}-${p(parts.day)}`;
}

/** 手動起票でタイトル未指定のときの既定タイトル（例: 「加盟店申請（2026/7/4 起票）」） */
export function defaultRunTitle(templateName: string, parts: DateParts): string {
  return `${templateName}（${parts.year}/${parts.month}/${parts.day} 起票）`;
}

/** shouldTriggerRule が参照する recurring_rules の最小形 */
export interface TriggerRuleInput {
  enabled: boolean;
  cadence: RecurringCadence;
  day_of_month: number | null;
  last_run_on: string | null;
}

/**
 * 定期起票ルールを今日（JST）起票すべきか判定する。
 * - daily: last_run_on が今日でなければ起票
 * - monthly: 今日の「日」が day_of_month と一致し、かつ last_run_on が今日でなければ起票
 * last_run_on の比較で同日の多重起票を防止する（Cron の再実行に耐える）。
 * @param rule 判定対象ルール
 * @param today JST の今日（getJstDateParts の結果を注入）
 */
export function shouldTriggerRule(rule: TriggerRuleInput, today: DateParts): boolean {
  if (!rule.enabled) return false;
  const todayStr = toJstDateString(today);
  if (rule.last_run_on === todayStr) return false;
  if (rule.cadence === "daily") return true;
  // monthly
  if (rule.day_of_month == null) return false;
  return rule.day_of_month === today.day;
}

/**
 * 期限超過か判定する（due_date < 今日）。
 * @param dueDate "YYYY-MM-DD" または null
 * @param todayStr "YYYY-MM-DD"（toJstDateString の結果を注入）
 */
export function isOverdue(dueDate: string | null, todayStr: string): boolean {
  return !!dueDate && dueDate < todayStr;
}

/**
 * フロー図の「現在地」＝seq順で最初に todo のステップの添字を返す。
 * skipped は消化済み扱いで飛ばす。全ステップ消化済みなら -1（現在地なし＝完了）。
 * @param statuses seq 昇順に並んだステップ状態
 */
export function resolveCurrentStepIndex(statuses: WorkflowStepStatus[]): number {
  return statuses.findIndex((s) => s === "todo");
}

/**
 * テンプレのカテゴリを「今日のUD」の大分類に割り当てる。
 * settlement / daily（定期起票される定例業務）→ daily（日々の運用）、
 * それ以外（merchant 等の案件対応・カテゴリ不明含む）→ adhoc（都度の対応）。
 * @param category workflow_templates.category（null は都度扱い）
 */
export function categoryToTaskGroup(category: string | null): "daily" | "adhoc" {
  return category === "settlement" || category === "daily" ? "daily" : "adhoc";
}
