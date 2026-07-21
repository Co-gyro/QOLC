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

/** 申請を更新（状態/優先度/担当者/期限/次アクション/UD追記情報） */
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

/** JSON POST の共通ヘッダ */
const JSON_POST = { method: "POST", headers: { "Content-Type": "application/json" } } as const;

/** 手動起票の入力（電話・窓口受付をその場で記録する） */
export interface ApplicationCreateInput {
  source: string;
  applicant_name: string;
  applicant_org?: string;
  applicant_email?: string;
  applicant_phone?: string;
  message: string;
}

/** 案件を手動で起票する（管理者用。作成者と created イベントが記録される） */
export async function createApplication(
  input: ApplicationCreateInput
): Promise<{ id: string }> {
  return request<{ id: string }>("/api/admin/applications", {
    ...JSON_POST,
    body: JSON.stringify(input),
  });
}

/** 対応メモ（comment イベント）を記録する */
export async function postApplicationComment(
  id: string,
  text: string
): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/admin/applications/${id}/comments`, {
    ...JSON_POST,
    body: JSON.stringify({ text }),
  });
}

/** 申請前採番（モールコード・端末識別番号のプール払い出し）を実行する */
export async function assignApplicationCodes(
  id: string
): Promise<{ mallCode: string; terminalId: string; already: boolean }> {
  return request<{ mallCode: string; terminalId: string; already: boolean }>(
    `/api/admin/applications/${id}/assign-codes`,
    { ...JSON_POST, body: JSON.stringify({}) }
  );
}

/** 申請工程（merchant_application テンプレ13工程）を起票する */
export async function startApplicationWorkflow(
  id: string
): Promise<{ runId: string; stepCount: number }> {
  return request<{ runId: string; stepCount: number }>(
    `/api/admin/applications/${id}/workflow`,
    { ...JSON_POST, body: JSON.stringify({}) }
  );
}

/** 審査結果1社分の保存入力 */
export interface ReviewSaveInput {
  company: "jcb" | "saison";
  submitted_at?: string | null;
  result?: "approved" | "rejected" | null;
  result_received_at?: string | null;
  ng_reason?: string | null;
  merchant_code_recurring?: string | null;
  merchant_code_ec?: string | null;
  merchant_code?: string | null;
}

/** 審査結果（JCB/セゾン）を登録する */
export async function saveApplicationReview(
  id: string,
  input: ReviewSaveInput
): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/admin/applications/${id}/review`, {
    ...JSON_POST,
    body: JSON.stringify(input),
  });
}

/** メール送信結果（送信スキップ時の画面表示に使用） */
export interface ApplicationEmailResult {
  sent: boolean;
  skipped: boolean;
  to: string;
  error?: string;
}

/** 審査通過メールを送信する（結果は email_sent イベントに記録される） */
export async function sendApplicationEmail(
  id: string,
  template: "review_approved"
): Promise<ApplicationEmailResult> {
  return request<ApplicationEmailResult>(`/api/admin/applications/${id}/email`, {
    ...JSON_POST,
    body: JSON.stringify({ template }),
  });
}

/** 加盟店変換の結果 */
export interface ConvertResult {
  merchantId: string;
  mallCode: string | null;
  terminalId: string | null;
}

/** 審査通過後、申請を加盟店として登録する */
export async function convertApplication(
  id: string,
  input: { note?: string; assign_mall_code?: boolean; assign_terminal_id?: boolean }
): Promise<ConvertResult> {
  return request<ConvertResult>(`/api/admin/applications/${id}/convert`, {
    ...JSON_POST,
    body: JSON.stringify(input),
  });
}
