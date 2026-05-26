/**
 * POST /api/payment/card/init
 *
 * カード登録の初期化。3DセキュアEC決済(checkout)の自動送信フォーム定義を返す。
 * フロントエンドは返却された url/fields でフォームを生成し USEN 決済画面へ遷移させる。
 *
 * - jutyu_cd はサイトコードで採番（会員登録用途）→ check_cd はサイト鍵で署名
 * - sum_price=1（カード有効性確認）、member_id を指定してカードを紐付け
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildCheckoutForm } from "@/lib/payment/ec-api";
import { nextJutyuCd, formatUsenDate } from "@/lib/payment/member-api";
import { logPaymentAudit } from "@/lib/payment/audit-log";
import { apiError, apiOk } from "@/types/api";

const requestSchema = z.object({
  residentAccountId: z.string().uuid(),
});

const SUM_PRICE = 1; // カード有効性確認は1円

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
  const parsed = requestSchema.safeParse(body);
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
    return NextResponse.json(
      apiError("支払いオーナーのみがカード登録できます", "NOT_PAYMENT_OWNER"),
      { status: 403 }
    );
  }
  if (account.usen_member_id) {
    return NextResponse.json(apiError("既にカードが登録されています", "ALREADY_REGISTERED"), { status: 409 });
  }

  const siteCd = process.env.USEN_SITE_CD;
  if (!siteCd) {
    return NextResponse.json(apiError("USEN_SITE_CD 未設定", "CONFIG"), { status: 500 });
  }

  // サイトコードで jutyu_cd を採番（会員登録用途）
  const jutyuCd = await nextJutyuCd(siteCd);
  // 会員IDは resident_account から生成（英数・最大48桁）
  const memberId = "M" + account.id.replace(/-/g, "");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // ret_url にコールバック検証に必要な情報を付与（sum_price, resident_account_id）
  const retUrl =
    `${baseUrl}/api/payment/card/callback` +
    `?ra=${encodeURIComponent(account.id)}&sp=${SUM_PRICE}`;

  const form = buildCheckoutForm(
    {
      jutyu_cd: jutyuCd,
      sum_price: SUM_PRICE,
      jutyu_day: formatUsenDate(),
      member_id: memberId,
      item_name: "QOLC カード登録",
      ret_url: retUrl,
      ret_url_type: "GET",
    },
    "site"
  );

  await logPaymentAudit({
    action: "ec_checkout",
    request: { jutyu_cd: jutyuCd, sum_price: SUM_PRICE, member_id: memberId },
    performedBy: user.id,
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json(
    apiOk({ url: form.url, method: form.method, fields: form.fields, jutyuCd, memberId })
  );
}
