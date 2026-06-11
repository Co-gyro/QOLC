/**
 * POST /api/payment/reg/[memberId]/token/init
 *
 * ec-payment-web-adapter-token の startPaymentProcess から呼ばれる加盟店サーバエンドポイント。
 * トークン+カード情報を受け取り、check_cd・必須パラメータを補完して USEN /i/token/init を呼ぶ。
 * レスポンスはそのままフロントへ返却する（3DS認証が開始される）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { tokenInit, residentAccountIdFromMemberId } from "@/lib/payment/token-ec-api";
import { formatUsenDate } from "@/lib/payment/member-api";
import { logPaymentAudit } from "@/lib/payment/audit-log";
import { apiError } from "@/types/api";

// カード登録時の与信額。業界慣習(Amazon/楽天/Stripe等)に倣い1円とする。
// 6/5に発生した JCB code=02(G42=暗証番号エラー) は JCB側の PIN必須フラグ設定の問題で
// あり、金額(1円vs100円)は無関係であることが 6/11 に判明・解消済み。
// 当日中に売上未計上のまま与信失効する（=実課金されない）。
const REGISTER_SUM_PRICE = 1;

const bodySchema = z.object({
  jutyu_cd: z.string().min(1),
  token: z.string().min(1),
  card_limit_yyyy: z.string().regex(/^\d{4}$/),
  card_limit_mm: z.string().regex(/^\d{2}$/),
  cardholder_name: z.string().min(1).max(45),
  pay_method: z.string().optional().nullable(),
  pay_times: z.string().optional().nullable(),
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

  // 3DS必須の連絡先（メール）を取得
  const email = user.email ?? undefined;
  if (!email) {
    return NextResponse.json(apiError("メールアドレスが必要です", "NO_EMAIL"), { status: 422 });
  }

  try {
    const res = await tokenInit({
      jutyu_cd: parsed.data.jutyu_cd,
      sum_price: REGISTER_SUM_PRICE,
      jutyu_day: formatUsenDate(),
      token: parsed.data.token,
      card_limit_yyyy: parsed.data.card_limit_yyyy,
      card_limit_mm: parsed.data.card_limit_mm,
      cardholder_name: parsed.data.cardholder_name,
      member_id: memberId,
      pay_method: parsed.data.pay_method ?? undefined,
      three_ds_cardholder_info: { email },
    });

    await logPaymentAudit({
      action: "ec_checkout",
      request: { jutyu_cd: parsed.data.jutyu_cd, sum_price: REGISTER_SUM_PRICE, member_id: memberId },
      response: res,
      performedBy: user.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
    });

    // レスポンスをそのままフロントへ返却（3DSプロセス開始）
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(apiError(`決済初期化に失敗しました: ${msg}`, "USEN_ERROR"), { status: 502 });
  }
}
