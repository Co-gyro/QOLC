/**
 * 申請/タスク ハブ クライアント側 API 呼び出し
 *
 * admin-queries の fetch ラッパー様式（success/error 判定）を踏襲する。
 */
import type {
  ApplicationRow,
  ApplicationDetail,
  AssigneeOption,
  ApplicationPatch,
} from "./types";

/** API 応答の共通形（apiOk/apiError） */
type ApiResp<T> = { success: true; data: T } | { success: false; error: string };

/** 共通 fetch: 成功時 data を返し、失敗時は throw */
async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error);
  return json.data;
}

/** フィルタ条件（未指定は絞り込みなし） */
export interface ApplicationFilters {
  status?: string;
  assignee?: string;
  source?: string;
}

/** 一覧取得 */
export async function fetchApplications(
  filters: ApplicationFilters = {}
): Promise<ApplicationRow[]> {
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.assignee) qs.set("assignee", filters.assignee);
  if (filters.source) qs.set("source", filters.source);
  const q = qs.toString();
  const data = await request<{ items: ApplicationRow[] }>(
    `/api/admin/applications${q ? `?${q}` : ""}`
  );
  return data.items;
}

/** 詳細 + 履歴取得 */
export async function fetchApplicationDetail(id: string): Promise<ApplicationDetail> {
  return request<ApplicationDetail>(`/api/admin/applications/${id}`);
}

/** アサイン候補（admin ユーザー）取得 */
export async function fetchAssignees(): Promise<AssigneeOption[]> {
  const data = await request<{ items: AssigneeOption[] }>(
    "/api/admin/applications/assignees"
  );
  return data.items;
}

/** 申請を更新（状態/優先度/担当者/期限/次アクション） */
export async function patchApplication(
  id: string,
  patch: ApplicationPatch
): Promise<{ id: string; updated: string[] }> {
  return request<{ id: string; updated: string[] }>(`/api/admin/applications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
