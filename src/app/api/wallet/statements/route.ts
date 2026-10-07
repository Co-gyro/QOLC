/**
 * GET /api/wallet/statements
 * 明細の取込の一覧（新しい順・運営センター）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { authorizeWalletAdmin, walletError } from "@/lib/wallet/auth";
import { apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

/** 取込の一覧 */
export async function GET(req: NextRequest) {
  const auth = await authorizeWalletAdmin(req);
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.admin.from("card_statement_imports")
    .select("id, file_name, target_month, line_count, imported_at, reconciled_at")
    .is("deleted_at", null)
    .order("imported_at", { ascending: false })
    .limit(50);
  if (error) return walletError("取込の一覧を読み込めませんでした", "DB_ERROR", 500).response;
  return NextResponse.json(apiOk({ imports: data ?? [] }));
}
