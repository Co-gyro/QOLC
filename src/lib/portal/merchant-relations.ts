/**
 * 加盟店に紐づく申請（applications.merchant_id）と業務タスク（workflow_runs.merchant_id）を
 * 加盟店IDごとにまとめて取得する（加盟店管理の「関連案件」列用）。
 *
 * applications / workflow 系テーブルが未適用の DB でも一覧全体を落とさないよう、
 * 取得失敗時は空 Map にフォールバックする（段階フォールバック原則）。
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ApplicationSource, ApplicationStatus } from "@/lib/applications/labels";
import type { WorkflowRunStatus } from "@/lib/workflow/types";

/** 加盟店に紐づく申請の最小形 */
export interface MerchantRelatedApplication {
  id: string;
  source: ApplicationSource;
  status: ApplicationStatus;
}

/** 加盟店に紐づく業務タスクの最小形 */
export interface MerchantRelatedRun {
  id: string;
  title: string;
  status: WorkflowRunStatus;
}

/** 加盟店1件分の関連案件 */
export interface MerchantRelations {
  applications: MerchantRelatedApplication[];
  runs: MerchantRelatedRun[];
}

/** merchant_id を持つ行の共通形（グルーピング入力） */
interface WithMerchantId {
  merchant_id: string | null;
}

/**
 * 申請・タスクの行を merchant_id ごとの MerchantRelations にまとめる（純関数）。
 * merchant_id が null の行は無視する。
 */
export function groupRelationsByMerchant(
  apps: Array<MerchantRelatedApplication & WithMerchantId>,
  runs: Array<MerchantRelatedRun & WithMerchantId>
): Map<string, MerchantRelations> {
  const map = new Map<string, MerchantRelations>();
  const entry = (id: string): MerchantRelations => {
    const found = map.get(id);
    if (found) return found;
    const created: MerchantRelations = { applications: [], runs: [] };
    map.set(id, created);
    return created;
  };
  for (const a of apps) {
    if (!a.merchant_id) continue;
    entry(a.merchant_id).applications.push({ id: a.id, source: a.source, status: a.status });
  }
  for (const r of runs) {
    if (!r.merchant_id) continue;
    entry(r.merchant_id).runs.push({ id: r.id, title: r.title, status: r.status });
  }
  return map;
}

/** 単一テーブルの関連行を取得する（テーブル未適用・権限エラー時は空配列） */
async function safeSelect<T>(table: "applications" | "workflow_runs", columns: string): Promise<T[]> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .not("merchant_id", "is", null)
      .is("deleted_at", null)
      .limit(500);
    if (error) return [];
    return (data ?? []) as unknown as T[];
  } catch {
    return [];
  }
}

/** 加盟店IDごとの関連申請・タスクを取得する（失敗時は空 Map） */
export async function fetchMerchantRelations(): Promise<Map<string, MerchantRelations>> {
  const [apps, runs] = await Promise.all([
    safeSelect<MerchantRelatedApplication & WithMerchantId>(
      "applications",
      "id, source, status, merchant_id"
    ),
    safeSelect<MerchantRelatedRun & WithMerchantId>(
      "workflow_runs",
      "id, title, status, merchant_id"
    ),
  ]);
  return groupRelationsByMerchant(apps, runs);
}
