/**
 * その他業務タスク（ops_tasks）の純ロジック（DBアクセスなし）
 *
 * - 状態・ラベル・並び順の定義
 * - 定例自動起票ルール（コード定義。日付判定は cron から日付を注入してテスト可能に保つ）
 */
import type { DateParts } from "@/lib/workflow/utils";

/** タスクの状態（todo=未着手 / in_progress=対応中 / done=完了 / on_hold=保留） */
export type OpsTaskStatus = "todo" | "in_progress" | "done" | "on_hold";

export const OPS_STATUS_LABELS: Record<OpsTaskStatus, string> = {
  todo: "未着手",
  in_progress: "対応中",
  done: "完了",
  on_hold: "保留",
};

/** 状態バッジの配色（今日のUD・一覧共通のトーンに合わせる） */
export const OPS_STATUS_COLORS: Record<OpsTaskStatus, { bg: string; fg: string }> = {
  todo: { bg: "#FCF1E3", fg: "#B45309" },
  in_progress: { bg: "#E6F4EA", fg: "#1B5E20" },
  done: { bg: "#F3F4F6", fg: "#4B5563" },
  on_hold: { bg: "#FAE8FF", fg: "#86198F" },
};

export const ALL_OPS_STATUSES: readonly OpsTaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "on_hold",
];

/** 一覧1行分のタスク */
export interface OpsTask {
  id: string;
  title: string;
  status: OpsTaskStatus;
  category: string | null;
  assigneeId: string | null;
  assigneeName?: string | null;
  dueDate: string | null;
  note: string | null;
  recurringKey: string | null;
  createdAt: string;
}

/** 進行中（未完了）とみなす状態 */
export const OPEN_OPS_STATUSES: readonly OpsTaskStatus[] = ["todo", "in_progress", "on_hold"];

const STATUS_ORDER: Record<OpsTaskStatus, number> = {
  in_progress: 0,
  todo: 1,
  on_hold: 2,
  done: 3,
};

/** 一覧の並び順: 対応中→未着手→保留→完了、同状態内は期限昇順（なしは最後） */
export function compareOpsTasks(a: OpsTask, b: OpsTask): number {
  const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (so !== 0) return so;
  if (a.dueDate === b.dueDate) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

// ============================================================
// 定例自動起票（コード定義ルール）
// ============================================================

/** 定例起票ルール（毎月 day 日に起票し、期限を dueDay 日にする） */
export interface OpsRecurringRule {
  /** recurring_key に入る一意キー */
  key: string;
  /** 起票日（JSTの日）。この日以降の cron 実行で起票される（unique 制約で1回のみ） */
  day: number;
  /** タイトル（{year}/{month} を展開） */
  titlePattern: string;
  category: string;
  /** 期限日（当月。起票日より前なら翌月扱いにはしない＝運用で調整） */
  dueDay: number;
}

/**
 * 定例ルール一覧（タスク管理表 G: 入金管理・消込 由来）。
 * 起票日・期限は初期値。実際の入金サイクルに合わせてここを編集する。
 */
export const OPS_RECURRING_RULES: readonly OpsRecurringRule[] = [
  {
    key: "deposit_check_15",
    day: 20,
    titlePattern: "JCB・セゾンからの入金確認・照合（{year}年{month}月 15日締め分）",
    category: "入金管理",
    dueDay: 28,
  },
  {
    key: "deposit_check_eom",
    day: 5,
    titlePattern: "JCB・セゾンからの入金確認・照合（前月末日締め分）",
    category: "入金管理",
    dueDay: 15,
  },
];

/** period（'YYYY-MM'）を組み立てる */
export function periodOf(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

/** その日に起票すべきルールを返す（day 当日以降の月内は毎日候補になり、unique 制約で1回に収束） */
export function rulesDueOn(parts: DateParts): OpsRecurringRule[] {
  return OPS_RECURRING_RULES.filter((r) => parts.day >= r.day);
}

/** ルールから ops_tasks の insert 行を組み立てる */
export function buildOpsTaskRow(
  rule: OpsRecurringRule,
  parts: DateParts
): Record<string, unknown> {
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    title: rule.titlePattern
      .replace("{year}", String(parts.year))
      .replace("{month}", String(parts.month)),
    status: "todo",
    category: rule.category,
    due_date: `${parts.year}-${p(parts.month)}-${p(rule.dueDay)}`,
    recurring_key: rule.key,
    period: periodOf(parts),
  };
}
