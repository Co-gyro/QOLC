/**
 * ポータル間の関係リスト取得（RLSで自動スコープ）
 * - provider: 取引先施設一覧（紐づく施設）
 * - facility_staff: 提携サービス提供者（加盟店）一覧
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface LinkedFacilityRow {
  id: string;
  name: string;
  residentCount: number;
}

/** provider の取引先施設（RLSで active 関係の施設のみ可視） */
export async function fetchProviderFacilities(): Promise<LinkedFacilityRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("facilities")
    .select("id, name, residents(count)")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(`取引先施設の取得に失敗: ${error.message}`);
  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    residents: { count: number }[];
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    residentCount: r.residents?.[0]?.count ?? 0,
  }));
}

export interface LinkedMerchantRow {
  id: string;
  name: string;
  mallCode: string | null;
  status: string;
}

/** facility_staff の提携加盟店（facility_merchant_relations 経由） */
export async function fetchFacilityProviders(): Promise<LinkedMerchantRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("facility_merchant_relations")
    .select("status, merchants(id, name, mall_code)")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`提携加盟店の取得に失敗: ${error.message}`);
  const rows = (data ?? []) as unknown as {
    status: string;
    merchants: { id: string; name: string; mall_code: string | null } | null;
  }[];
  return rows
    .filter((r) => r.merchants)
    .map((r) => ({
      id: r.merchants!.id,
      name: r.merchants!.name,
      mallCode: r.merchants!.mall_code,
      status: r.status,
    }));
}
