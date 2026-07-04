/**
 * ワークフロー（業務タスク）API のクライアント側呼び出しと表示用ヘルパー
 *
 * applications/client.ts の fetch ラッパー様式（success/error 判定）を踏襲する。
 */
import type { WorkflowRunStatus, WorkflowStepStatus } from "@/lib/workflow/types";
import type { RunProgress } from "./workflow-logic";

/** API 応答の共通形（apiOk/apiError） */
type ApiResp<T> = { success: true; data: T } | { success: false; error: string };

/** 共通 fetch: 成功時 data を返し、失敗時は throw */
async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error);
  return json.data;
}

/** テンプレのカテゴリ → 日本語ラベル（未知の値はそのまま表示） */
export const CATEGORY_LABELS: Record<string, string> = {
  settlement: "精算",
  merchant: "加盟店",
  daily: "日次運用",
};

/** カテゴリの表示名を返す（未定義カテゴリはそのまま/nullは「—」） */
export function categoryLabel(category: string | null): string {
  if (!category) return "—";
  return CATEGORY_LABELS[category] ?? category;
}

/** ISO 日時 → "YYYY/MM/DD"（null は「—」） */
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

/** ISO 日時 → "YYYY/MM/DD HH:mm"（完了記録「誰が・いつ」の表示用） */
export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 一覧1行分の run（進捗・担当者名解決済み） */
export interface WorkflowRunListItem {
  id: string;
  templateCode: string;
  templateName: string | null;
  category: string | null;
  title: string;
  status: WorkflowRunStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  progress: RunProgress;
}

/** チェックリスト詳細のステップ1件（完了者名解決済み） */
export interface WorkflowStepItem {
  id: string;
  seq: number;
  title: string;
  guide: string | null;
  externalUrl: string | null;
  externalLabel: string | null;
  status: WorkflowStepStatus;
  completedBy: string | null;
  completedByName: string | null;
  completedAt: string | null;
  note: string | null;
}

/** run 詳細（steps 込み） */
export interface WorkflowRunDetail extends WorkflowRunListItem {
  note: string | null;
  applicationId: string | null;
  merchantId: string | null;
  createdByName: string | null;
  steps: WorkflowStepItem[];
}

/** 起票ダイアログ用のテンプレ選択肢 */
export interface WorkflowTemplateOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  stepCount: number;
}

/** 一覧のフィルタ条件（未指定は絞り込みなし） */
export interface WorkflowRunFilters {
  status?: WorkflowRunStatus;
  assignee?: string;
  template_code?: string;
}

/** run 一覧を取得 */
export async function fetchWorkflowRuns(
  filters: WorkflowRunFilters = {}
): Promise<WorkflowRunListItem[]> {
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.assignee) qs.set("assignee", filters.assignee);
  if (filters.template_code) qs.set("template_code", filters.template_code);
  const q = qs.toString();
  const data = await request<{ items: WorkflowRunListItem[] }>(
    `/api/admin/workflow-runs${q ? `?${q}` : ""}`
  );
  return data.items;
}

/** run 詳細（steps 込み）を取得 */
export async function fetchWorkflowRunDetail(id: string): Promise<WorkflowRunDetail> {
  return request<WorkflowRunDetail>(`/api/admin/workflow-runs/${id}`);
}

/** 起票可能なテンプレ一覧を取得 */
export async function fetchWorkflowTemplates(): Promise<WorkflowTemplateOption[]> {
  const data = await request<{ items: WorkflowTemplateOption[] }>(
    "/api/admin/workflow-runs/templates"
  );
  return data.items;
}

/** 手動起票の入力 */
export interface CreateRunInput {
  template_code: string;
  title?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  note?: string | null;
}

/** テンプレから run を手動起票する */
export async function createWorkflowRun(
  input: CreateRunInput
): Promise<{ id: string; title: string }> {
  return request<{ id: string; title: string }>("/api/admin/workflow-runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** run の更新可能フィールド */
export interface RunPatch {
  title?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  note?: string | null;
  status?: WorkflowRunStatus;
}

/** run を更新（タイトル/担当者/期限/メモ/状態） */
export async function patchWorkflowRun(
  id: string,
  patch: RunPatch
): Promise<{ id: string; updated: string[] }> {
  return request<{ id: string; updated: string[] }>(`/api/admin/workflow-runs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

/** ステップの更新可能フィールド */
export interface StepPatch {
  status?: WorkflowStepStatus;
  note?: string | null;
}

/** ステップを更新（チェック/スキップ/メモ）。run の自動完了/再開の結果も返る */
export async function patchWorkflowStep(
  runId: string,
  stepId: string,
  patch: StepPatch
): Promise<{ stepId: string; runStatus: WorkflowRunStatus; autoCompleted: boolean }> {
  return request<{ stepId: string; runStatus: WorkflowRunStatus; autoCompleted: boolean }>(
    `/api/admin/workflow-runs/${runId}/steps/${stepId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }
  );
}
