/**
 * GET /api/wallet/residents
 * お買い物の利用ができる自施設の入居者（宣言用の最小情報）。入居者の元データは residents。
 */
import { NextResponse, type NextRequest } from "next/server";
import { authorizeWalletStaff } from "@/lib/wallet/auth";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

/** 入居者一覧を返す */
export async function GET(req: NextRequest) {
  const staff = await authorizeWalletStaff(req);
  if ("response" in staff) return staff.response;

  const { data, error } = await staff.admin
    .from("residents")
    .select("id, name_last, name_first, name_last_kana, name_first_kana, room_label, photo_url")
    .eq("facility_id", staff.facilityId)
    .eq("wallet_enabled", true)
    .is("deleted_at", null)
    .order("name_last_kana", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json(apiError("入居者を読み込めませんでした", "DB_ERROR"), { status: 500 });
  return NextResponse.json(apiOk({ residents: data ?? [] }));
}
