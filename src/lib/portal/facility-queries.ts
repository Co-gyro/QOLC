/**
 * 施設ポータル用クエリ（入居者管理）
 *
 * ブラウザクライアント + RLS。facility_staff は自施設の入居者のみ読み書き可能
 * （RLS: facility_id = jwt_facility_id()）。INSERT/UPDATE 時は facility_id を明示。
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ResidentFormValues } from "./schemas";

export interface ResidentRow {
  id: string;
  nameLast: string;
  nameFirst: string;
  nameLastKana: string | null;
  nameFirstKana: string | null;
  insuranceNumber: string;
  /** カード登録済み（usen_member_id を持つ resident_account がある） */
  cardRegistered: boolean;
  /** 家族/本人アカウント数 */
  accountCount: number;
}

interface RawResident {
  id: string;
  name_last: string;
  name_first: string;
  name_last_kana: string | null;
  name_first_kana: string | null;
  insurance_number: string;
  resident_accounts: { usen_member_id: string | null; deleted_at: string | null }[];
}

/** ログイン中ユーザー（facility_staff）の所属施設IDを取得 */
export async function getMyFacilityId(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("facility_id")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.facility_id as string | null) ?? null;
}

/** 入居者一覧（カード登録状態・アカウント数つき）。RLSで自施設に限定される。 */
export async function fetchResidents(): Promise<ResidentRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("residents")
    .select(
      "id, name_last, name_first, name_last_kana, name_first_kana, insurance_number, resident_accounts(usen_member_id, deleted_at)"
    )
    .is("deleted_at", null)
    .order("name_last_kana", { ascending: true });
  if (error) throw new Error(`入居者の取得に失敗しました: ${error.message}`);
  const rows = (data ?? []) as unknown as RawResident[];
  return rows.map((r) => {
    const accounts = (r.resident_accounts ?? []).filter((a) => !a.deleted_at);
    return {
      id: r.id,
      nameLast: r.name_last,
      nameFirst: r.name_first,
      nameLastKana: r.name_last_kana,
      nameFirstKana: r.name_first_kana,
      insuranceNumber: r.insurance_number,
      cardRegistered: accounts.some((a) => !!a.usen_member_id),
      accountCount: accounts.length,
    };
  });
}

function toResidentRecord(v: ResidentFormValues, facilityId: string) {
  return {
    facility_id: facilityId,
    name_last: v.name_last.trim(),
    name_first: v.name_first.trim(),
    name_last_kana: v.name_last_kana?.trim() || null,
    name_first_kana: v.name_first_kana?.trim() || null,
    insurance_number: v.insurance_number.trim(),
  };
}

export async function createResident(
  facilityId: string,
  v: ResidentFormValues
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("residents").insert(toResidentRecord(v, facilityId));
  if (error) {
    if (error.code === "23505") {
      throw new Error("同じ被保険者番号の入居者が既に登録されています");
    }
    throw new Error(`入居者の登録に失敗しました: ${error.message}`);
  }
}

export async function updateResident(
  id: string,
  facilityId: string,
  v: ResidentFormValues
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("residents")
    .update(toResidentRecord(v, facilityId))
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      throw new Error("同じ被保険者番号の入居者が既に登録されています");
    }
    throw new Error(`入居者の更新に失敗しました: ${error.message}`);
  }
}

export async function softDeleteResident(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("residents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`入居者の削除に失敗しました: ${error.message}`);
}

export { toResidentRecord };

/** 家族招待を発行（サーバーAPI経由でトークン生成） */
export async function createInvitation(
  residentId: string,
  opts: { accountType: "self" | "family"; isPaymentOwner: boolean }
): Promise<{ token: string; url: string; expiresAt: string }> {
  const res = await fetch("/api/facility/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      residentId,
      accountType: opts.accountType,
      isPaymentOwner: opts.isPaymentOwner,
    }),
  });
  const json = (await res.json()) as
    | { success: true; data: { token: string; url: string; expiresAt: string } }
    | { success: false; error: string };
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export interface ResidentAccountDetail {
  id: string;
  type: "self" | "family";
  isPaymentOwner: boolean;
  cardRegistered: boolean;
  displayName: string | null;
  email: string | null;
}

export interface InvitationDetail {
  id: string;
  accountType: "self" | "family";
  isPaymentOwner: boolean;
  email: string | null;
  status: "pending" | "used" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface ResidentDetail {
  resident: { nameLast: string; nameFirst: string; insuranceNumber: string };
  accounts: ResidentAccountDetail[];
  invitations: InvitationDetail[];
}

/** 入居者詳細（アカウント一覧・招待状況）を取得 */
export async function fetchResidentDetail(residentId: string): Promise<ResidentDetail> {
  const res = await fetch(`/api/facility/residents/${residentId}`);
  const json = (await res.json()) as
    | { success: true; data: ResidentDetail }
    | { success: false; error: string };
  if (!json.success) throw new Error(json.error);
  return json.data;
}

/** 支払い担当者を指定アカウントに設定/移譲 */
export async function setPaymentOwner(residentId: string, accountId: string): Promise<void> {
  const res = await fetch(`/api/facility/residents/${residentId}/payment-owner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
  const json = (await res.json()) as
    | { success: true; data: unknown }
    | { success: false; error: string };
  if (!json.success) throw new Error(json.error);
}
