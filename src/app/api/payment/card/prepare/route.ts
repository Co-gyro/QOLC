/**
 * POST /api/payment/card/prepare
 *
 * トークン式カード登録の準備。受注コード(jutyu_cd)・会員ID・モールコードを払い出し、
 * フロントの ec-payment-web-adapter-token 初期化に必要な情報を返す。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { nextJutyuCd } from "@/lib/payment/member-api";
import { deriveMemberId } from "@/lib/payment/token-ec-api";
import { apiError, apiOk } from "@/types/api";

const schema = z.object({ residentAccountId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(apiError("認証されていません", "UNAUTHORIZED"), { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: account } = await admin
    .from("resident_accounts")
    .select("id, user_id, is_payment_owner, usen_member_id")
    .eq("id", parsed.data.residentAccountId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!account || account.user_id !== user.id) {
    return NextResponse.json(apiError("対象アカウントが見つかりません", "NOT_FOUND"), { status: 404 });
  }
  if (!account.is_payment_owner) {
    return NextResponse.json(apiError("支払いオーナーのみがカード登録できます", "NOT_PAYMENT_OWNER"), { status: 403 });
  }
  if (account.usen_member_id) {
    return NextResponse.json(apiError("既にカードが登録されています", "ALREADY_REGISTERED"), { status: 409 });
  }

  const mallCd = process.env.USEN_MALL_CD;
  if (!mallCd) {
    return NextResponse.json(apiError("USEN_MALL_CD 未設定", "CONFIG"), { status: 500 });
  }

  const jutyuCd = await nextJutyuCd(mallCd);
  const memberId = deriveMemberId(account.id);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const merchantApiBaseUrl = `${baseUrl}/api/payment/reg/${memberId}`;

  return NextResponse.json(apiOk({ jutyuCd, mallCd, memberId, merchantApiBaseUrl }));
}
