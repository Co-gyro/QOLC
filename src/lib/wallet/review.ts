/**
 * QOLC Wallet: 突合の結果の読み出し（運営センターの画面と API で共用）。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { RECONCILE_TARGET_STATUSES } from "./statements";

/** 結果の明細行 */
export interface ReviewLine {
  id: string;
  line_no: number;
  card_last4: string | null;
  usage_date: string | null;
  merchant_name: string | null;
  amount: number | null;
  match_status: string;
  facility_name: string | null;
  resident_name: string | null;
  declaration_merchant: string | null;
}

/** 明細に現れていない記録 */
export interface ReviewDeclaration {
  id: string;
  facility_name: string | null;
  resident_name: string | null;
  merchant_name: string | null;
  amount: number | null;
  paid_at: string | null;
  status: string;
}

/** 突合の結果 */
export interface StatementReview {
  import: { id: string; file_name: string; target_month: string | null; imported_at: string; reconciled_at: string | null };
  lines: ReviewLine[];
  unmatched_declarations: ReviewDeclaration[];
}

type Named = { name: string } | null;
type Person = { name_last: string; name_first: string } | null;

/** 氏名 */
function personName(p: Person): string | null {
  return p ? `${p.name_last} ${p.name_first}` : null;
}

/** 取込1件の突合の結果を読む */
export async function loadStatementReview(admin: SupabaseClient, importId: string): Promise<StatementReview | null> {
  const { data: imported } = await admin.from("card_statement_imports")
    .select("id, file_name, target_month, imported_at, reconciled_at").eq("id", importId).maybeSingle();
  if (!imported) return null;

  const { data: rows } = await admin.from("card_statement_lines")
    .select("id, line_no, card_last4, usage_date, merchant_name, amount, match_status, facility_id, " +
      "facilities(name), purchase_declarations(merchant_name, residents(name_last, name_first))")
    .eq("import_id", importId).is("deleted_at", null).order("line_no");
  const lines: ReviewLine[] = ((rows ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const decl = r.purchase_declarations as { merchant_name: string | null; residents: Person } | null;
    return {
      id: r.id as string,
      line_no: r.line_no as number,
      card_last4: (r.card_last4 as string | null) ?? null,
      usage_date: (r.usage_date as string | null) ?? null,
      merchant_name: (r.merchant_name as string | null) ?? null,
      amount: (r.amount as number | null) ?? null,
      match_status: r.match_status as string,
      facility_name: (r.facilities as Named)?.name ?? null,
      resident_name: personName(decl?.residents ?? null),
      declaration_merchant: decl?.merchant_name ?? null,
    };
  });

  const facilityIds = Array.from(new Set(((rows ?? []) as unknown as { facility_id: string | null }[])
    .map((r) => r.facility_id).filter((v): v is string => v !== null)));
  let unmatched: ReviewDeclaration[] = [];
  if (imported.reconciled_at && facilityIds.length > 0) {
    const { data: decls } = await admin.from("purchase_declarations")
      .select("id, status, merchant_name, amount, entered_amount, paid_at, facilities(name), residents(name_last, name_first)")
      .in("facility_id", facilityIds).in("status", RECONCILE_TARGET_STATUSES).is("deleted_at", null)
      .order("paid_at", { ascending: true });
    unmatched = ((decls ?? []) as unknown as Record<string, unknown>[]).map((d) => ({
      id: d.id as string,
      facility_name: (d.facilities as Named)?.name ?? null,
      resident_name: personName(d.residents as Person),
      merchant_name: (d.merchant_name as string | null) ?? null,
      amount: (d.amount as number | null) ?? (d.entered_amount as number | null) ?? null,
      paid_at: (d.paid_at as string | null) ?? null,
      status: d.status as string,
    }));
  }
  return { import: imported as StatementReview["import"], lines, unmatched_declarations: unmatched };
}
