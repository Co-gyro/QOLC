/**
 * POST /api/wallet/statements/import（multipart/form-data, file）
 * カード会社の明細 CSV を取り込む（運営センター）。カードは下4桁で特定し、番号の残りは保存しない。
 */
import { NextResponse, type NextRequest } from "next/server";
import { logActivity } from "@/lib/audit/activity-log";
import { authorizeWalletAdmin, walletError } from "@/lib/wallet/auth";
import { parseStatementCsv } from "@/lib/wallet/statement-csv";
import { cardsByLast4, toLineRows } from "@/lib/wallet/statements";
import { apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const CSV_TYPES = ["text/csv", "application/vnd.ms-excel", "application/octet-stream", ""];

/** 明細 CSV を取り込む */
export async function POST(req: NextRequest) {
  const auth = await authorizeWalletAdmin(req);
  if ("response" in auth) return auth.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv") || !CSV_TYPES.includes(file.type)) {
    return walletError("CSV ファイルを選んでください", "VALIDATION", 400).response;
  }
  if (file.size > MAX_BYTES) return walletError("ファイルが大きすぎます（10MB まで）", "VALIDATION", 400).response;

  const parsed = parseStatementCsv(new Uint8Array(await file.arrayBuffer()));
  if (parsed.errors.length > 0) return walletError(parsed.errors.join(" / "), "VALIDATION", 400).response;

  const { data: imported, error } = await auth.admin.from("card_statement_imports")
    .insert({ file_name: file.name, target_month: parsed.targetMonth, line_count: parsed.lines.length, imported_by: auth.userId })
    .select("id, file_name, target_month, line_count, imported_at")
    .single();
  if (error || !imported) return walletError("取込を記録できませんでした", "DB_ERROR", 500).response;

  const rows = toLineRows(imported.id as string, parsed.lines, await cardsByLast4(auth.admin));
  const { error: lineError } = await auth.admin.from("card_statement_lines").insert(rows);
  if (lineError) return walletError("明細を保存できませんでした", "DB_ERROR", 500).response;

  await logActivity({
    actorId: auth.userId,
    action: "wallet_statement_import",
    targetType: "card_statement_import",
    targetId: imported.id as string,
    targetLabel: file.name,
    metadata: { lines: rows.length, unknown_cards: rows.filter((r) => !r.is_reference && !r.facility_id).length },
  });
  return NextResponse.json(apiOk({ import: imported }), { status: 201 });
}
