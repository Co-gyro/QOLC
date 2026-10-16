/**
 * GET  /api/admin/udpay/members?merchantId= — 加盟店の利用者（担当者・承認者）一覧（UD管理者のみ）
 * POST /api/admin/udpay/members             — 利用者のアカウント発行（招待メール。送れなくても招待リンクを返す）
 */
import { NextResponse, type NextRequest } from "next/server";
import { isUuid, requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { logActivity } from "@/lib/audit/activity-log";
import { buildMemberInviteMail, inviteMember, listMembers, memberInviteSchema } from "@/lib/udpay/prod/members-admin";
import { getUdpayMerchant } from "@/lib/udpay/prod/merchants";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  const merchantId = req.nextUrl.searchParams.get("merchantId") ?? "";
  if (!isUuid(merchantId)) return NextResponse.json(apiError("加盟店IDが不正です", "BAD_REQUEST"), { status: 400 });
  try {
    return NextResponse.json(apiOk(await listMembers(getSupabaseAdminClient(), merchantId)));
  } catch (e) {
    return NextResponse.json(apiError(e instanceof Error ? e.message : "取得に失敗しました"), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  const parsed = memberInviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0]?.message ?? "入力内容が不正です", "VALIDATION_ERROR"), { status: 400 });
  }
  const client = getSupabaseAdminClient();
  const merchant = await getUdpayMerchant(client, parsed.data.merchantId);
  if (!merchant) return NextResponse.json(apiError("UD Payment の加盟店ではありません", "NOT_FOUND"), { status: 404 });
  const r = await inviteMember(client, parsed.data, process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qolc.jp");
  if (!r.ok) return NextResponse.json(apiError(r.error, "INVITE_FAILED"), { status: r.status });
  const mail = buildMemberInviteMail({ displayName: parsed.data.displayName, merchantName: merchant.name, isApprover: parsed.data.isApprover, inviteUrl: r.inviteUrl });
  const emailResult = await sendEmail({ to: parsed.data.email, subject: mail.subject, text: mail.text, fromName: "UD Payment" });
  await logActivity({
    actorId: auth.user.id,
    action: "account_create",
    targetType: "account",
    targetId: r.userId,
    targetLabel: `${parsed.data.displayName}（${parsed.data.email}）`,
    metadata: { role: "udpay_merchant", merchant_id: merchant.id, merchant_name: merchant.name, is_approver: parsed.data.isApprover, email_sent: emailResult.sent },
  });
  return NextResponse.json(apiOk({ userId: r.userId, inviteUrl: r.inviteUrl, emailSent: emailResult.sent }));
}
