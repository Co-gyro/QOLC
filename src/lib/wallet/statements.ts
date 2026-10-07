/**
 * QOLC Wallet: カード明細の取込・突合の DB 処理（運営センター用。施設をまたいで扱う）。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { jstDate } from "./declarations";
import type { ReconcileDeclaration, ReconcileLine } from "./reconcile";
import type { StatementLine } from "./statement-csv";

/** 突合の対象にする記録の状態 */
export const RECONCILE_TARGET_STATUSES = [
  "awaiting_receipt", "declared", "matched", "mismatched", "confirmed", "needs_review",
];

/** 下4桁 → カード（同じ下4桁が複数の施設にあれば特定しない） */
export async function cardsByLast4(admin: SupabaseClient) {
  const { data } = await admin.from("facility_cards").select("id, facility_id, last4")
    .is("deleted_at", null).neq("status", "retired");
  const map = new Map<string, { cardId: string; facilityId: string } | null>();
  for (const c of data ?? []) {
    const key = String(c.last4);
    map.set(key, map.has(key) ? null : { cardId: c.id as string, facilityId: c.facility_id as string });
  }
  return map;
}

/** 明細行を DB に入れる形にする */
export function toLineRows(
  importId: string,
  lines: StatementLine[],
  cards: Map<string, { cardId: string; facilityId: string } | null>,
) {
  return lines.map((l) => {
    const card = l.cardLast4 ? cards.get(l.cardLast4) ?? null : null;
    return {
      import_id: importId,
      line_no: l.lineNo,
      facility_id: card?.facilityId ?? null,
      card_id: card?.cardId ?? null,
      card_last4: l.cardLast4,
      target_month: l.targetMonth,
      usage_date: l.usageDate,
      merchant_name: l.merchantName,
      amount: l.amount,
      sales_type: l.salesType,
      installment_count: l.installmentCount,
      installment_no: l.installmentNo,
      payment_amount: l.paymentAmount,
      note: l.note,
      is_reference: l.isReference,
      match_status: l.isReference ? "excluded" : "unmatched",
    };
  });
}

/** DB の明細行を突合の入力にする */
export function toReconcileLine(row: Record<string, unknown>): ReconcileLine {
  return {
    id: row.id as string,
    lineNo: row.line_no as number,
    cardId: (row.card_id as string | null) ?? null,
    facilityId: (row.facility_id as string | null) ?? null,
    usageDate: (row.usage_date as string | null) ?? null,
    merchantName: (row.merchant_name as string | null) ?? null,
    amount: (row.amount as number | null) ?? null,
    isReference: Boolean(row.is_reference),
  };
}

/** 施設の、突合の対象になる記録を読む */
export async function loadReconcileDeclarations(
  admin: SupabaseClient,
  facilityIds: string[],
): Promise<ReconcileDeclaration[]> {
  if (facilityIds.length === 0) return [];
  const { data } = await admin.from("purchase_declarations")
    .select("id, facility_id, card_id, amount, entered_amount, merchant_name, printed_at, paid_at, selected_at")
    .in("facility_id", facilityIds)
    .in("status", RECONCILE_TARGET_STATUSES)
    .is("deleted_at", null);
  return (data ?? []).map((d) => ({
    id: d.id as string,
    facilityId: d.facility_id as string,
    cardId: (d.card_id as string | null) ?? null,
    amount: (d.amount as number | null) ?? (d.entered_amount as number | null) ?? null,
    purchaseDate: jstDate((d.printed_at ?? d.paid_at ?? d.selected_at) as string),
    merchantName: (d.merchant_name as string | null) ?? null,
    paidAt: (d.paid_at as string | null) ?? null,
  }));
}
