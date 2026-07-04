/**
 * ワークフローエンジンの型定義（migration 030 のテーブルと1対1対応）
 *
 * - workflow_templates.steps(jsonb) は WorkflowTemplateStep[] を保持する
 * - 起票（run 作成）時にテンプレのステップを workflow_run_steps へスナップショットする
 *   （テンプレ変更が過去の記録を壊さない＝監査性の担保）
 */

/** テンプレートに定義するステップ（workflow_templates.steps jsonb の要素） */
export interface WorkflowTemplateStep {
  /** 工程順（1始まりの連番） */
  seq: number;
  /** 工程名（一覧・チェックリストに表示） */
  title: string;
  /** 作業ガイド（何をどうやるか・完了条件。マニュアル不要で作業できる具体性で書く） */
  guide: string;
  /** 外部システム/画面へのリンク（任意） */
  external_url?: string;
  /** リンクボタンの表示名（external_url とセットで指定） */
  external_label?: string;
}

/** ワークフローテンプレート（workflow_templates の行） */
export interface WorkflowTemplate {
  id: string;
  /** テンプレート識別コード（例: monthly_settlement_15） */
  code: string;
  name: string;
  description: string | null;
  /** 分類（settlement=精算 / merchant=加盟店 / daily=日次運用） */
  category: string | null;
  steps: WorkflowTemplateStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** 起票された作業（run）の状態 */
export type WorkflowRunStatus = "open" | "done" | "canceled";

/** 各ステップの状態 */
export type WorkflowStepStatus = "todo" | "done" | "skipped";

/** 定期起票の周期 */
export type RecurringCadence = "daily" | "monthly";

/** run 状態の日本語ラベル */
export const RUN_STATUS_LABELS: Record<WorkflowRunStatus, string> = {
  open: "進行中",
  done: "完了",
  canceled: "中止",
};

/** ステップ状態の日本語ラベル */
export const STEP_STATUS_LABELS: Record<WorkflowStepStatus, string> = {
  todo: "未着手",
  done: "完了",
  skipped: "スキップ",
};

/** 起票された作業（workflow_runs の行） */
export interface WorkflowRun {
  id: string;
  template_id: string | null;
  /** 起票元テンプレのコード（テンプレ削除後も残る） */
  template_code: string;
  title: string;
  status: WorkflowRunStatus;
  assignee_id: string | null;
  /** 申請ハブ案件との紐付け（任意） */
  application_id: string | null;
  /** 加盟店との紐付け（任意） */
  merchant_id: string | null;
  due_date: string | null;
  note: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** run のステップ（workflow_run_steps の行。起票時にテンプレからスナップショット） */
export interface WorkflowRunStep {
  id: string;
  run_id: string;
  seq: number;
  title: string;
  guide: string | null;
  external_url: string | null;
  external_label: string | null;
  status: WorkflowStepStatus;
  completed_by: string | null;
  completed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** 定期起票ルール（recurring_rules の行） */
export interface RecurringRule {
  id: string;
  /** ルール識別コード（例: settlement_15_monthly） */
  code: string;
  name: string;
  template_code: string;
  cadence: RecurringCadence;
  /** monthly のとき起票する日（1〜31）。daily は null */
  day_of_month: number | null;
  /** 起票タイトルのパターン（{year}/{month}/{day}/{prev_year}/{prev_month} を置換） */
  title_pattern: string;
  enabled: boolean;
  default_assignee: string | null;
  /** 最終起票日（多重起票防止） */
  last_run_on: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** workflow_run_steps へ INSERT する行（buildRunSteps の出力） */
export interface NewRunStep {
  seq: number;
  title: string;
  guide: string | null;
  external_url: string | null;
  external_label: string | null;
  status: WorkflowStepStatus;
}
