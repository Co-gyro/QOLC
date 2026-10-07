/**
 * POST /api/wallet/statements/:id/reconcile
 * 取り込んだ明細と記録を突合する（運営センター）。照合できた記録は reconciled にする。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/audit/activity-log";
import { authorizeWalletAdmin, walletError } from "@/lib/wallet/auth";
import { reconcile } from "@/lib/wallet/reconcile";
import { loadReconcileDeclarations, toReconcileLine } from "@/lib/wallet/statements";
import { apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

/** 突合を実行する */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeWalletAdmin(req);
  if ("response" in auth) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return walletError("入力が正しくありません", "VALIDATION", 400).response;

  // 先取りロック（二重実行を防ぐ）
  const { data: locked } = await auth.admin.from("card_statement_imports")
    .update({ reconciled_at: new Date().toISOString() })
    .eq("id", params.id).is("reconciled_at", null).is("deleted_at", null)
    .select("id").maybeSingle();
  if (!locked) return walletError("この明細は突合済みか、見つかりません", "CONFLICT", 409).response;

  const { data: lineRows } = await auth.admin.from("card_statement_lines")
    .select("id, line_no, card_id, facility_id, usage_date, merchant_name, amount, is_reference")
    .eq("import_id", params.id).is("deleted_at", null);
  const lines = (lineRows ?? []).map(toReconcileLine);
  const facilityIds = Array.from(new Set(lines.map((l) => l.facilityId).filter((v): v is string => v !== null)));
  const result = reconcile(lines, await loadReconcileDeclarations(auth.admin, facilityIds));

  for (const r of result.lines) {
    await auth.admin.from("card_statement_lines")
      .update({ match_status: r.status, declaration_id: r.declarationId }).eq("id", r.lineId);
  }
  const matchedIds = result.lines.flatMap((r) => (r.declarationId ? [r.declarationId] : []));
  if (matchedIds.length > 0) {
    await auth.admin.from("purchase_declarations").update({ status: "reconciled" }).in("id", matchedIds);
  }

  const summary = {
    matched: result.lines.filter((r) => r.status === "matched").length,
    needs_review: result.lines.filter((r) => r.status === "needs_review").length,
    excluded: result.lines.filter((r) => r.status === "excluded").length,
  };
  await logActivity({
    actorId: auth.userId,
    action: "wallet_statement_reconcile",
    targetType: "card_statement_import",
    targetId: params.id,
    metadata: summary,
  });
  return NextResponse.json(apiOk({ summary }));
}
