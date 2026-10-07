/**
 * GET /api/wallet/declarations/pending
 * レシート待ちの記録（支払いの古い順）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { authorizeWalletStaff, walletError } from "@/lib/wallet/auth";
import { DECLARATION_SELECT, type DeclarationRow, toDtos } from "@/lib/wallet/declarations";
import { apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

/** レシート待ちの一覧 */
export async function GET(req: NextRequest) {
  const staff = await authorizeWalletStaff(req);
  if ("response" in staff) return staff.response;
  const { data, error } = await staff.admin
    .from("purchase_declarations")
    .select(DECLARATION_SELECT)
    .eq("facility_id", staff.facilityId)
    .eq("status", "awaiting_receipt")
    .is("deleted_at", null)
    .order("paid_at", { ascending: true });
  if (error) return walletError("記録を読み込めませんでした", "DB_ERROR", 500).response;
  return NextResponse.json(apiOk({ declarations: await toDtos(staff.admin, (data ?? []) as unknown as DeclarationRow[]) }));
}
