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

/** 詳細（本体 + payload + タイムライン） */
export interface ApplicationDetail extends ApplicationRow {
  payload: Record<string, unknown> | null;
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
}
