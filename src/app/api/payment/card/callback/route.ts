/**
 * GET /api/payment/card/callback
 *
 * 3DセキュアEC決済(checkout)完了後の ret_url コールバック。
 * - USEN から jutyu_cd, user_card_corp, member_id, check_cd が返る
 * - 自前で付与した ra(resident_account_id), sp(sum_price) も受け取る
 * - check_cd を検証し、会員登録成功なら usen_member_id を保存
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyReturnCheckCode, isRegistrationSuccess } from "@/lib/payment/ec-api";
import { logPaymentAudit } from "@/lib/payment/audit-log";

async function handle(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const jutyu_cd = sp.get("jutyu_cd") ?? "";
  const user_card_corp = sp.get("user_card_corp") ?? "";
  const member_id = sp.get("member_id") ?? "";
  const check_cd = sp.get("check_cd") ?? "";
  const residentAccountId = sp.get("ra") ?? "";
  const sumPrice = Number(sp.get("sp") ?? "1");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const performedBy = user?.id ?? null;
  const ip = req.headers.get("x-forwarded-for") ?? null;

  const redirect = (status: string, reason?: string) =>
    NextResponse.redirect(
      new URL(
        `/user/card?status=${status}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`,
        req.url
      )
    );

  await logPaymentAudit({
    action: "ec_return",
    request: { jutyu_cd, user_card_corp, member_id_present: !!member_id, ra: residentAccountId },
    performedBy,
    ipAddress: ip,
  });

  // check_cd 検証（jutyu_cd はサイトコードで採番したため site 鍵）
  if (!jutyu_cd || !check_cd) {
    return redirect("failed", "missing_params");
  }
  const valid = verifyReturnCheckCode({ jutyu_cd, user_card_corp, check_cd }, sumPrice, "site");
  if (!valid) {
    return redirect("failed", "invalid_check_cd");
  }

  // 会員登録成功判定（member_id が非ブランク）
  if (!isRegistrationSuccess({ member_id })) {
    return redirect("failed", "registration_failed");
  }

  // usen_member_id を保存
  if (residentAccountId) {
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from("resident_accounts")
      .update({ usen_member_id: member_id })
      .eq("id", residentAccountId)
      .is("usen_member_id", null);
    if (error) {
      return redirect("failed", "save_failed");
    }
  }

  return redirect("registered");
}

export const GET = handle;
export const POST = handle;
