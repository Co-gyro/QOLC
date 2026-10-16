import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { authVoid, salesCancel, salesReturn } from "@/lib/payment/member-api";
import { refundKindFor, type RefundDeps, type RefundKind } from "./refund";

/**
 * UD 管理画面の決済一覧（取消・返品の操作用）。
 */

/** 管理画面に出す決済1件 */
export interface AdminPaymentRow {
  id: string;
  customerName: string;
  serviceMonth: string;
  amount: number;
  status: string;
  scheduledDate: string;
  capturedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  jutyuCd: string | null;
  attemptCount: number;
  lastError: string | null;
  /** 入金済みのとき、今操作すると取消（当日）か返品（翌日以降）か */
  refundKind: RefundKind | null;
}

/** 加盟店の決済一覧（新しい課金日から100件） */
export async function listAdminPayments(client: SupabaseClient, merchantId: string, now: Date): Promise<AdminPaymentRow[]> {
  const { data, error } = await client
    .from("udpay_payments")
    .select("id, amount, status, scheduled_date, captured_at, cancelled_at, refunded_at, usen_jutyu_cd, attempt_count, last_error_code, last_error_message, udpay_customers(name), udpay_invoices(service_month)")
    .eq("merchant_id", merchantId)
    .order("scheduled_date", { ascending: false })
    .limit(100);
  if (error) throw new Error(`決済の取得に失敗: ${error.message}`);
  type Row = {
    id: string; amount: number; status: string; scheduled_date: string; captured_at: string | null;
    cancelled_at: string | null; refunded_at: string | null; usen_jutyu_cd: string | null; attempt_count: number;
    last_error_code: string | null; last_error_message: string | null;
    udpay_customers: { name: string } | null; udpay_invoices: { service_month: string } | null;
  };
  return ((data ?? []) as unknown as Row[])
    // 課金前に決済確定を取り消したもの（課金していない）は出さない
    .filter((r) => !(r.status === "cancelled" && !r.captured_at))
    .map((r) => ({
      id: r.id,
      customerName: r.udpay_customers?.name ?? "—",
      serviceMonth: r.udpay_invoices?.service_month ?? "",
      amount: Number(r.amount),
      status: r.status,
      scheduledDate: r.scheduled_date,
      capturedAt: r.captured_at,
      cancelledAt: r.cancelled_at,
      refundedAt: r.refunded_at,
      jutyuCd: r.usen_jutyu_cd,
      attemptCount: r.attempt_count,
      lastError: r.last_error_message ?? r.last_error_code,
      refundKind: r.status === "captured" && r.captured_at ? refundKindFor(r.captured_at, now) : null,
    }));
}

/** 本番の取消・返品で使う実際の依存（操作した管理者を監査ログに残す） */
export function createRefundDeps(performedBy: string): RefundDeps {
  const ctx = { performedBy };
  return {
    client: getSupabaseAdminClient(),
    salesCancel: (args) => salesCancel(args, ctx),
    authVoid: (args) => authVoid(args, ctx),
    salesReturn: (args) => salesReturn(args, ctx),
    now: () => new Date(),
  };
}
