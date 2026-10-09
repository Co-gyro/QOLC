/**
 * POST /api/admin/udpay/customers/[id]/registration-mail
 * カード登録のご案内メールを顧客の宛先（To/CC）へ送る（UD管理者のみ）。送付履歴に記録する。
 */
import { NextResponse } from "next/server";
import { isUuid, requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCustomer } from "@/lib/udpay/prod/customers";
import { getUdpayMerchant } from "@/lib/udpay/prod/merchants";
import { registrationUrl } from "@/lib/udpay/prod/identifiers";
import { sendCardRegistrationMail } from "@/lib/udpay/prod/mail";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  if (!isUuid(params.id)) return NextResponse.json(apiError("顧客IDが不正です", "BAD_REQUEST"), { status: 400 });
  const client = getSupabaseAdminClient();
  const customer = await getCustomer(client, params.id);
  if (!customer) return NextResponse.json(apiError("顧客が見つかりません", "NOT_FOUND"), { status: 404 });
  const merchant = await getUdpayMerchant(client, customer.merchantId);
  if (!merchant) return NextResponse.json(apiError("加盟店の設定がありません", "NOT_FOUND"), { status: 404 });
  try {
    const result = await sendCardRegistrationMail(client, {
      customer,
      merchant,
      url: registrationUrl(customer.registrationToken),
      sentBy: auth.user.id,
    });
    if (result.status === "failed") {
      return NextResponse.json(apiError(`送信に失敗しました: ${result.error ?? ""}`, "SEND_FAILED"), { status: 502 });
    }
    return NextResponse.json(apiOk(result));
  } catch (e) {
    return NextResponse.json(apiError(e instanceof Error ? e.message : "送信に失敗しました"), { status: 500 });
  }
}
