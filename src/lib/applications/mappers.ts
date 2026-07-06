/**
 * DB 生レコード → API 出力型への変換
 */
import type { ApplicationRow, ApplicationEvent } from "./types";
import type {
  ApplicationSource,
  ApplicationStatus,
  ApplicationPriority,
} from "./labels";

/** applications テーブルの生行（select したカラムのみ） */
export interface RawApplication {
  id: string;
  source: ApplicationSource;
  status: ApplicationStatus;
  priority: ApplicationPriority;
  applicant_name: string | null;
  applicant_org: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  /** UD追記情報（migration 031 追加列。select しない場合は undefined） */
  ud_input?: Record<string, unknown> | null;
  assignee_id: string | null;
  due_date: string | null;
  next_action: string | null;
  merchant_id: string | null;
  created_at: string;
  updated_at: string;
}

/** application_events テーブルの生行 */
export interface RawApplicationEvent {
  id: string;
  kind: string;
  detail: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
}

/**
 * 生の申請行を ApplicationRow へ変換する。
 * @param r 生行
 * @param nameOf assignee_id → 表示名 の解決関数
 */
export function toApplicationRow(
  r: RawApplication,
  nameOf: (id: string | null) => string | null
): ApplicationRow {
  return {
    id: r.id,
    source: r.source,
    status: r.status,
    priority: r.priority,
    applicantName: r.applicant_name,
    applicantOrg: r.applicant_org,
    applicantEmail: r.applicant_email,
    applicantPhone: r.applicant_phone,
    message: r.message,
    assigneeId: r.assignee_id,
    assigneeName: nameOf(r.assignee_id),
    dueDate: r.due_date,
    nextAction: r.next_action,
    merchantId: r.merchant_id,
    udInput: r.ud_input ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** 生のイベント行を ApplicationEvent へ変換する。 */
export function toApplicationEvent(
  r: RawApplicationEvent,
  nameOf: (id: string | null) => string | null
): ApplicationEvent {
  return {
    id: r.id,
    kind: r.kind,
    detail: r.detail,
    actorId: r.actor_id,
    actorName: nameOf(r.actor_id),
    createdAt: r.created_at,
  };
}
