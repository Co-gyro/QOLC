/**
 * workflow-runs API 共通: ユーザーID群 → 表示名の解決関数を作る
 *
 * applications API の buildAssigneeResolver と同一様式。
 * profiles の RLS を避けるため admin client（service_role）で取得する。
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 与えられたユーザー ID 群の display_name を一括取得し、
 * id→表示名 の解決関数を返す（未登録IDは null）。
 */
export async function buildNameResolver(
  ids: Array<string | null>
): Promise<(id: string | null) => string | null> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return () => null;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("profiles").select("id, display_name").in("id", unique);
  const map = new Map<string, string | null>();
  for (const p of (data ?? []) as Array<{ id: string; display_name: string | null }>) {
    map.set(p.id, p.display_name);
  }
  return (id: string | null) => (id ? map.get(id) ?? null : null);
}
