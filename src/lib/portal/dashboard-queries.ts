/**
 * 各ポータルのダッシュボード統計（ブラウザクライアント + RLS で自動スコープ）
 *
 * - admin: 全データ
 * - facility_staff: 自施設のデータ
 * - provider: 自加盟店のデータ
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchPayments, summarizePayments, type PaymentListRow } from "./payment-queries";

/** 当月1日の ISO（created_at フィルタ用） */
function startOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

/** PostgREST のフィルタビルダー（count用、最小限の型） */
interface CountQuery {
  is(col: string, val: null): CountQuery;
  gte(col: string, val: string): CountQuery;
  then(
    resolve: (r: { count: number | null; error: { message: string } | null }) => void
  ): void;
}

/** count 取得（RLSスコープ後の件数） */
async function countOf(
  table: string,
  build?: (q: CountQuery) => CountQuery
): Promise<number> {
  const supabase = createSupabaseBrowserClient();
  const base = supabase
    .from(table)
    .select("*", { count: "exact", head: true }) as unknown as CountQuery;
  const q = build ? build(base) : base;
  const { count, error } = await (q as unknown as Promise<{
    count: number | null;
    error: { message: string } | null;
  }>);
  if (error) throw new Error(`${table} の件数取得に失敗: ${error.message}`);
  return count ?? 0;
}

/** 当月の決済集計（RLSスコープ） */
async function monthlyPaymentSummary(): Promise<{ count: number; amount: number; failed: number; recent: PaymentListRow[] }> {
  const all = await fetchPayments(undefined, 500);
  const monthStart = startOfMonthISO().slice(0, 10);
  const monthly = all.filter((p) => p.date >= monthStart);
  const s = summarizePayments(monthly);
  return {
    count: s.total,
    amount: s.totalAmount,
    failed: s.byStatus["failed"]?.count ?? 0,
    recent: all.slice(0, 10),
  };
}

export interface AdminStats {
  facilityCount: number;
  residentCount: number;
  monthlyPaymentCount: number;
  monthlyPaymentAmount: number;
  errorCount: number;
  recentPayments: PaymentListRow[];
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const [facilityCount, residentCount, pay] = await Promise.all([
    countOf("facilities", (q) => q.is("deleted_at", null)),
    countOf("residents", (q) => q.is("deleted_at", null)),
    monthlyPaymentSummary(),
  ]);
  return {
    facilityCount,
    residentCount,
    monthlyPaymentCount: pay.count,
    monthlyPaymentAmount: pay.amount,
    errorCount: pay.failed,
    recentPayments: pay.recent,
  };
}

export interface FacilityStats {
  residentCount: number;
  cardUnregisteredCount: number;
  monthlyPaymentCount: number;
  monthlyPaymentAmount: number;
  recentPayments: PaymentListRow[];
}

export async function fetchFacilityStats(): Promise<FacilityStats> {
  const supabase = createSupabaseBrowserClient();
  const [residents, pay] = await Promise.all([
    supabase
      .from("residents")
      .select("id, resident_accounts(usen_member_id, deleted_at)")
      .is("deleted_at", null),
    monthlyPaymentSummary(),
  ]);
  if (residents.error) throw new Error(`入居者の取得に失敗: ${residents.error.message}`);
  const rows = (residents.data ?? []) as unknown as {
    resident_accounts: { usen_member_id: string | null; deleted_at: string | null }[];
  }[];
  const residentCount = rows.length;
  const cardUnregisteredCount = rows.filter(
    (r) => !(r.resident_accounts ?? []).some((a) => !a.deleted_at && a.usen_member_id)
  ).length;
  return {
    residentCount,
    cardUnregisteredCount,
    monthlyPaymentCount: pay.count,
    monthlyPaymentAmount: pay.amount,
    recentPayments: pay.recent,
  };
}

export interface ProviderStats {
  facilityCount: number;
  monthlyUploadCount: number;
  monthlyPaymentAmount: number;
}

export async function fetchProviderStats(): Promise<ProviderStats> {
  const monthStartIso = startOfMonthISO();
  const [facilityCount, uploadCount, pay] = await Promise.all([
    countOf("facilities", (q) => q.is("deleted_at", null)),
    countOf("upload_batches", (q) => q.gte("created_at", monthStartIso)),
    monthlyPaymentSummary(),
  ]);
  return {
    facilityCount,
    monthlyUploadCount: uploadCount,
    monthlyPaymentAmount: pay.amount,
  };
}
