/**
 * 管理データ（施設・加盟店・グループ）の取得・更新クエリ
 *
 * ブラウザクライアント + RLS（admin ポリシー）で実行。
 * admin ロールのみ書き込み可能（RLSが保証）。
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DisplayFrequency } from "@/types";
import type { FacilityFormValues } from "./schemas";

export interface FacilityRow {
  id: string;
  name: string;
  groupId: string | null;
  groupName: string | null;
  address: string | null;
  phone: string | null;
  displayFrequency: DisplayFrequency;
  residentCount: number;
}

interface RawFacility {
  id: string;
  name: string;
  group_id: string | null;
  address: string | null;
  phone: string | null;
  display_frequency: DisplayFrequency;
  facility_groups: { name: string | null } | null;
  residents: { count: number }[];
}

/** 施設一覧（グループ名・入居者数つき、論理削除を除く） */
export async function fetchFacilities(): Promise<FacilityRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("facilities")
    .select(
      "id, name, group_id, address, phone, display_frequency, facility_groups(name), residents(count)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`施設の取得に失敗しました: ${error.message}`);
  const rows = (data ?? []) as unknown as RawFacility[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    groupId: r.group_id,
    groupName: r.facility_groups?.name ?? null,
    address: r.address,
    phone: r.phone,
    displayFrequency: r.display_frequency,
    residentCount: r.residents?.[0]?.count ?? 0,
  }));
}

export interface FacilityGroupOption {
  id: string;
  name: string;
}

export async function fetchFacilityGroups(): Promise<FacilityGroupOption[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("facility_groups")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(`グループの取得に失敗しました: ${error.message}`);
  return (data ?? []) as FacilityGroupOption[];
}

/** フォーム値を DB カラムに変換（空文字は null に） */
function toFacilityRecord(v: FacilityFormValues) {
  return {
    name: v.name.trim(),
    group_id: v.group_id || null,
    address: v.address?.trim() || null,
    phone: v.phone?.trim() || null,
    display_frequency: v.display_frequency,
  };
}

export async function createFacility(v: FacilityFormValues): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("facilities").insert(toFacilityRecord(v));
  if (error) throw new Error(`施設の作成に失敗しました: ${error.message}`);
}

export async function updateFacility(id: string, v: FacilityFormValues): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("facilities")
    .update(toFacilityRecord(v))
    .eq("id", id);
  if (error) throw new Error(`施設の更新に失敗しました: ${error.message}`);
}

/** ソフトデリート（deleted_at を設定） */
export async function softDeleteFacility(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("facilities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`施設の削除に失敗しました: ${error.message}`);
}

export { toFacilityRecord };
