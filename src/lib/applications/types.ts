/**
 * 申請/タスク ハブの API 入出力型
 */
import type {
  ApplicationSource,
  ApplicationStatus,
  ApplicationPriority,
  ApplicationEventKind,
} from "./labels";

/** 一覧・詳細で共通する申請1件（担当者表示名を解決済み） */
export interface ApplicationRow {
  id: string;
  source: ApplicationSource;
  status: ApplicationStatus;
  priority: ApplicationPriority;
  applicantName: string | null;
  applicantOrg: string | null;
  applicantEmail: string | null;
  applicantPhone: string | null;
  message: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  nextAction: string | null;
  merchantId: string | null;
  /** UD追記情報（migration 031 の ud_input。審査ステージ判定・詳細表示に使用） */
  udInput?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/** 変更履歴イベント1件（操作者名を解決済み） */
export interface ApplicationEvent {
  id: string;
  kind: ApplicationEventKind | string;
  detail: Record<string, unknown> | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
}

/** 案件に紐づくワークフロー起票の進捗サマリ（workflow_runs / workflow_run_steps） */
export interface ApplicationWorkflowRunSummary {
  /** workflow_runs.id（/admin/tasks/{id} へのリンクに使用） */
  id: string;
  /** 起票タイトル */
  title: string;
  /** 進行状態（open=進行中 / done=完了 / canceled=中止） */
  status: "open" | "done" | "canceled";
  /** 完了済みステップ数 */
  doneCount: number;
  /** 全ステップ数 */
  totalCount: number;
}

/** 詳細（本体 + payload + タイムライン） */
export interface ApplicationDetail extends ApplicationRow {
  payload: Record<string, unknown> | null;
  /** 紐づく申請工程（未起票・テーブル未適用時は null / undefined） */
  workflowRun?: ApplicationWorkflowRunSummary | null;
  events: ApplicationEvent[];
}

/** アサイン候補（admin ユーザー） */
export interface AssigneeOption {
  id: string;
  name: string;
}

/** PATCH で更新可能なフィールド */
export interface ApplicationPatch {
  status?: ApplicationStatus;
  priority?: ApplicationPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  next_action?: string | null;
  /** UD追記情報（migration 031。全置換で保存する想定） */
  ud_input?: Record<string, unknown> | null;
  /** 申請内容（手動起票案件の補完・修正用。全置換で保存する想定） */
  payload?: Record<string, unknown>;
}
