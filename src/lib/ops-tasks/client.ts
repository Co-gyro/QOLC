/**
 * その他業務タスク（ops_tasks）のブラウザクエリ（RLS: admin のみ）
 *
 * migration 033 未適用の DB でも画面全体を落とさないよう、
 * 取得失敗時は「未適用フラグ」を返す段階フォールバックにする。
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { OpsTask, OpsTaskStatus } from "./logic";

interface RawOpsTask {
  id: string;
  title: string;
  status: OpsTaskStatus;
  category: string | null;
  assignee_id: string | null;
  due_date: string | null;
  note: string | null;
  recurring_key: string | null;
  created_at: string;
}

function toTask(r: RawOpsTask): OpsTask {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    category: r.category,
    assigneeId: r.assignee_id,
    dueDate: r.due_date,
    note: r.note,
    recurringKey: r.recurring_key,
    createdAt: r.created_at,
  };
}

export interface OpsTasksResult {
  tasks: OpsTask[];
  /** テーブル未作成（migration 033 未適用）の可能性 */
  unavailable: boolean;
}

/** タスク一覧を取得する（完了・削除済みを含めるかは呼び出し側でフィルタ） */
export async function fetchOpsTasks(): Promise<OpsTasksResult> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("ops_tasks")
      .select("id, title, status, category, assignee_id, due_date, note, recurring_key, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return { tasks: ((data ?? []) as unknown as RawOpsTask[]).map(toTask), unavailable: false };
  } catch {
    return { tasks: [], unavailable: true };
  }
}

/** タスクを起票する */
export async function createOpsTask(input: {
  title: string;
  category?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  note?: string;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("ops_tasks").insert({
    title: input.title,
    category: input.category?.trim() || null,
    assignee_id: input.assigneeId ?? null,
    due_date: input.dueDate || null,
    note: input.note?.trim() || null,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(`起票に失敗しました: ${error.message}`);
}

/** 状態を変更する（done は完了記録＝誰が・いつ を残す） */
export async function updateOpsTaskStatus(id: string, status: OpsTaskStatus): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const completion =
    status === "done"
      ? { completed_at: new Date().toISOString(), completed_by: user?.id ?? null }
      : { completed_at: null, completed_by: null };
  const { error } = await supabase
    .from("ops_tasks")
    .update({ status, ...completion })
    .eq("id", id);
  if (error) throw new Error(`更新に失敗しました: ${error.message}`);
}

/** 担当・期限・メモを更新する */
export async function updateOpsTaskFields(
  id: string,
  patch: { assigneeId?: string | null; dueDate?: string | null; note?: string | null }
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const row: Record<string, unknown> = {};
  if ("assigneeId" in patch) row.assignee_id = patch.assigneeId ?? null;
  if ("dueDate" in patch) row.due_date = patch.dueDate || null;
  if ("note" in patch) row.note = patch.note?.trim() || null;
  const { error } = await supabase.from("ops_tasks").update(row).eq("id", id);
  if (error) throw new Error(`更新に失敗しました: ${error.message}`);
}
