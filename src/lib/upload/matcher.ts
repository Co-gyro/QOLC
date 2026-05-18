/**
 * 被保険者番号 × 施設 マッチング処理
 *
 * 外部提供者からのアップロード時、被保険者番号で複数施設を横断検索し、
 * facility_id / resident_id を決定する。
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface MatchInput {
  insuranceNumber: string;
  facilityIds: string[];
}

export interface MatchResult {
  status: "matched" | "unmatched" | "ambiguous";
  facilityId?: string;
  residentId?: string;
}

/**
 * 指定された施設群に属する residents から被保険者番号でマッチング。
 */
export async function matchInsuranceNumber(
  client: SupabaseClient,
  input: MatchInput
): Promise<MatchResult> {
  if (input.facilityIds.length === 0) {
    return { status: "unmatched" };
  }
  const { data, error } = await client
    .from("residents")
    .select("id, facility_id")
    .eq("insurance_number", input.insuranceNumber)
    .in("facility_id", input.facilityIds)
    .is("deleted_at", null);
  if (error || !data || data.length === 0) {
    return { status: "unmatched" };
  }
  if (data.length > 1) {
    return { status: "ambiguous" };
  }
  return {
    status: "matched",
    facilityId: data[0].facility_id as string,
    residentId: data[0].id as string,
  };
}

/**
 * provider 用: facility_merchant_relations から active な施設一覧を取得。
 */
export async function getActiveFacilityIdsForMerchant(
  client: SupabaseClient,
  merchantId: string
): Promise<string[]> {
  const { data, error } = await client
    .from("facility_merchant_relations")
    .select("facility_id")
    .eq("merchant_id", merchantId)
    .eq("status", "active");
  if (error || !data) return [];
  return (data as Array<{ facility_id: string }>).map((r) => r.facility_id);
}
