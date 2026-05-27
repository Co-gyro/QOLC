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

// ============================================================
// 加盟店（merchants）
// ============================================================

export interface MerchantRow {
  id: string;
  name: string;
  nameKana: string | null;
  address: string | null;
  phone: string | null;
  mallCode: string | null;
  terminalId: string | null;
  uploadFormatId: string | null;
  facilityCount: number;
}

interface RawMerchant {
  id: string;
  name: string;
  name_kana: string | null;
  address: string | null;
  phone: string | null;
  mall_code: string | null;
  terminal_id: string | null;
  upload_format_id: string | null;
  facility_merchant_relations: { count: number }[];
}

/** 加盟店一覧（提携施設数つき、論理削除を除く） */
export async function fetchMerchants(): Promise<MerchantRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("merchants")
    .select(
      "id, name, name_kana, address, phone, mall_code, terminal_id, upload_format_id, facility_merchant_relations(count)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`加盟店の取得に失敗しました: ${error.message}`);
  const rows = (data ?? []) as unknown as RawMerchant[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameKana: r.name_kana,
    address: r.address,
    phone: r.phone,
    mallCode: r.mall_code,
    terminalId: r.terminal_id,
    uploadFormatId: r.upload_format_id,
    facilityCount: r.facility_merchant_relations?.[0]?.count ?? 0,
  }));
}

export interface UploadFormatOption {
  id: string;
  name: string;
}

export async function fetchUploadFormats(): Promise<UploadFormatOption[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("upload_formats").select("id, name").order("name");
  if (error) throw new Error(`フォーマットの取得に失敗しました: ${error.message}`);
  return (data ?? []) as UploadFormatOption[];
}

/** 加盟店の基本情報更新（プールは変更しない） */
export async function updateMerchant(
  id: string,
  v: { name: string; name_kana?: string; address?: string; phone?: string; upload_format_id?: string | null }
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("merchants")
    .update({
      name: v.name.trim(),
      name_kana: v.name_kana?.trim() || null,
      address: v.address?.trim() || null,
      phone: v.phone?.trim() || null,
      upload_format_id: v.upload_format_id || null,
    })
    .eq("id", id);
  if (error) throw new Error(`加盟店の更新に失敗しました: ${error.message}`);
}

export async function softDeleteMerchant(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("merchants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`加盟店の削除に失敗しました: ${error.message}`);
}

/** 既存加盟店へ未割当コードを払い出す（サーバーAPI経由） */
export async function assignMerchantCodes(
  id: string,
  opts: { mall?: boolean; terminal?: boolean }
): Promise<{ mallCode: string | null; terminalId: string | null }> {
  const res = await fetch(`/api/admin/merchants/${id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assign_mall_code: opts.mall ?? false,
      assign_terminal_id: opts.terminal ?? false,
    }),
  });
  const json = (await res.json()) as
    | { success: true; data: { mallCode: string | null; terminalId: string | null } }
    | { success: false; error: string };
  if (!json.success) throw new Error(json.error);
  return json.data;
}

/** 加盟店作成（プール払い出しを含むためサーバーAPI経由） */
export async function createMerchant(v: {
  name: string;
  name_kana?: string;
  address?: string;
  phone?: string;
  upload_format_id?: string | null;
  assign_mall_code?: boolean;
  assign_terminal_id?: boolean;
}): Promise<{ id: string; mallCode: string | null; terminalId: string | null }> {
  const res = await fetch("/api/admin/merchants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(v),
  });
  const json = (await res.json()) as
    | { success: true; data: { id: string; mallCode: string | null; terminalId: string | null } }
    | { success: false; error: string };
  if (!json.success) throw new Error(json.error);
  return json.data;
}
