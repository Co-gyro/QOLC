/**
 * POST /api/payment/reg/[memberId]/pay
 *
 * 3DS認証後（OnPaymentStart）に呼ばれる。USEN /i/pay を実行し、
 * 成功なら会員ID（カード）を resident_account に保存する（カード登録完了）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { pay, isTokenOk, residentAccountIdFromMemberId } from "@/lib/payment/token-ec-api";
import { logPaymentAudit } from "@/lib/payment/audit-log";
import { apiError, apiOk } from "@/types/api";

const bodySchema = z.object({
  jutyu_cd: z.string().min(1),
  token: z.string().min(1),
  check_cd: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: { memberId: string } }) {
  const memberId = params.memberId;
  const residentAccountId = residentAccountIdFromMemberId(memberId);
  if (!residentAccountId) {
    return NextResponse.json(apiError("不正な会員IDです", "BAD_MEMBER_ID"), { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(apiError("認証されていません", "UNAUTHORIZED"), { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const { data: account } = await admin
    .from("resident_accounts")
    .select("id, user_id, is_payment_owner")
    .eq("id", residentAccountId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!account || account.user_id !== user.id || !account.is_payment_owner) {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }

  try {
    const res = await pay({
      jutyu_cd: parsed.data.jutyu_cd,
      token: parsed.data.token,
      check_cd: parsed.data.check_cd,
    });

    await logPaymentAudit({
      action: "ec_checkout",
      request: { jutyu_cd: parsed.data.jutyu_cd, member_id: memberId },
      response: res,
      performedBy: user.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
    });

    if (!isTokenOk(res)) {
      return NextResponse.json(apiError(`決済に失敗しました (code=${res.code})`, "PAY_NG"), {
        status: 402,
      });
    }

    // カード登録成功 → 会員IDを保存（与信1円は別途取消運用 or capture無しのため売上化しない）
    const savedMemberId = res.member_id || memberId;
    const { error } = await admin
      .from("resident_accounts")
      .update({ usen_member_id: savedMemberId })
      .eq("id", residentAccountId)
      .is("usen_member_id", null);
    if (error) {
      return NextResponse.json(apiError(`会員ID保存に失敗: ${error.message}`, "SAVE_FAILED"), {
        status: 500,
      });
    }

    return NextResponse.json(apiOk({ memberId: savedMemberId, brand: res.brand ?? null }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(apiError(`決済に失敗しました: ${msg}`, "USEN_ERROR"), { status: 502 });
  }
}
