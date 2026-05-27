/**
 * GET /api/invite?token=xxx
 *
 * 招待トークンの有効性を確認し、表示用情報（入居者名・施設名）を返す（公開）。
 * service_role で照合（anon は invitations を直接読めない）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json(apiError("トークンがありません", "BAD_REQUEST"), { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select(
      "id, account_type, is_payment_owner, expires_at, used_at, residents(name_last, name_first), facilities(name)"
    )
    .eq("token", token)
    .maybeSingle();

  if (!inv) {
    return NextResponse.json(apiError("招待が見つかりません", "NOT_FOUND"), { status: 404 });
  }
  if (inv.used_at) {
    return NextResponse.json(apiError("この招待は既に使用されています", "USED"), { status: 410 });
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return NextResponse.json(apiError("この招待は有効期限が切れています", "EXPIRED"), { status: 410 });
  }

  const resident = inv.residents as unknown as { name_last: string; name_first: string } | null;
  const facility = inv.facilities as unknown as { name: string } | null;
  return NextResponse.json(
    apiOk({
      residentName: resident ? `${resident.name_last} ${resident.name_first}` : "（不明）",
      facilityName: facility?.name ?? "（不明）",
      accountType: inv.account_type,
      isPaymentOwner: inv.is_payment_owner,
    })
  );
}
