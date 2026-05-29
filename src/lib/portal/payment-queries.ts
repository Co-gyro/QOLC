/**
 * 決済データの実取得クエリ（ブラウザクライアント + RLS）
 *
 * RLSにより、admin は全件、facility_staff は自施設の入居者分、
 * provider は自加盟店分、family は自身の入居者分のみ取得される。
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PaymentStatus } from "@/types";

export interface PaymentListRow {
  id: string;
  date: string; // YYYY-MM-DD
  residentName: string;
  merchantName: string;
  amount: number;
  status: PaymentStatus;
  jutyuCd: string | null;
  /** 売上計上日時 (ISO)。取消/返金ダイアログで推奨操作の判定に使用 */
  capturedAt: string | null;
}

interface RawPaymentRow {
  id: string;
  total_amount: number | null;
  payment_status: PaymentStatus;
  usen_jutyu_cd: string | null;
  created_at: string;
  captured_at: string | null;
  residents: { name_last: string | null; name_first: string | null } | null;
  merchants: { name: string | null } | null;
}

/**
 * 決済一覧を取得する。RLS により呼び出しユーザーの権限内のデータのみ返る。
 * @param status - 指定時はそのステータスで絞り込み
 * @param limit - 取得上限（既定200）
 */
export async function fetchPayments(
  status?: PaymentStatus,
  limit = 200
): Promise<PaymentListRow[]> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("payments")
    .select(
      "id, total_amount, payment_status, usen_jutyu_cd, created_at, captured_at, residents(name_last, name_first), merchants(name)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) {
    query = query.eq("payment_status", status);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`決済の取得に失敗しました: ${error.message}`);
  }
  const rows = (data ?? []) as unknown as RawPaymentRow[];
  return rows.map((r) => ({
    id: r.id,
    date: (r.created_at ?? "").slice(0, 10),
    residentName: r.residents
      ? `${r.residents.name_last ?? ""} ${r.residents.name_first ?? ""}`.trim() || "(不明)"
      : "(不明)",
    merchantName: r.merchants?.name ?? "(不明)",
    amount: r.total_amount ?? 0,
    status: r.payment_status,
    jutyuCd: r.usen_jutyu_cd,
    capturedAt: r.captured_at,
  }));
}

/** ステータス別の件数・合計を集計（ダッシュボード等向け） */
export interface PaymentSummary {
  total: number;
  totalAmount: number;
  byStatus: Record<string, { count: number; amount: number }>;
}

export function summarizePayments(rows: PaymentListRow[]): PaymentSummary {
  const summary: PaymentSummary = { total: rows.length, totalAmount: 0, byStatus: {} };
  for (const r of rows) {
    summary.totalAmount += r.amount;
    const s = summary.byStatus[r.status] ?? { count: 0, amount: 0 };
    s.count += 1;
    s.amount += r.amount;
    summary.byStatus[r.status] = s;
  }
  return summary;
}
