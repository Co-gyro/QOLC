/**
 * POST /api/admin/merchants/[id]/accounts/[userId] — 利用者の操作（UD管理者のみ）
 *   action=password_setup: パスワード設定メールを送る（招待のし直し・パスワード再設定。相手に設定してもらう）
 *   action=suspend / resume: 利用停止（ログイン不可）・再開
 * 操作は activity_logs に記録する。メールが送れなくても、パスワード設定リンクを画面に返す。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isUuid, requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { logActivity } from "@/lib/audit/activity-log";
import { buildPasswordSetupMail, createPasswordSetupLink, findMerchantAccount, setAccountSuspended } from "@/lib/admin/merchant-accounts";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["password_setup", "suspend", "resume"]) });

export async function POST(req: NextRequest, { params }: { params: { id: string; userId: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  if (!isUuid(params.id) || !isUuid(params.userId)) return NextResponse.json(apiError("IDが不正です", "BAD_REQUEST"), { status: 400 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(apiError("操作が不正です", "BAD_REQUEST"), { status: 400 });
  const client = getSupabaseAdminClient();
  const account = await findMerchantAccount(client, params.id, params.userId);
  if (!account) return NextResponse.json(apiError("この加盟店の利用者ではありません", "NOT_FOUND"), { status: 404 });
  const log = (action: string, metadata: Record<string, unknown> = {}) =>
    logActivity({
      actorId: auth.user.id,
      action,
      targetType: "account",
      targetId: account.userId,
      targetLabel: `${account.displayName}（${account.email ?? ""}）`,
      metadata: { merchant_id: params.id, kind: account.kind, ...metadata },
    });

  if (parsed.data.action === "password_setup") {
    const link = await createPasswordSetupLink(client, account.userId, process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qolc.jp");
    if (!link.ok) return NextResponse.json(apiError(link.error, "LINK_FAILED"), { status: 500 });
    const mail = buildPasswordSetupMail({ kind: account.kind, displayName: account.displayName, link: link.link, firstTime: account.status === "invited" });
    const sent = await sendEmail({ to: link.email, subject: mail.subject, text: mail.text, fromName: account.kind === "udpay" ? "UD Payment" : undefined });
    await log("account_password_setup", { email_sent: sent.sent, first_time: account.status === "invited" });
    return NextResponse.json(apiOk({ link: link.link, emailSent: sent.sent }));
  }
  const suspend = parsed.data.action === "suspend";
  const r = await setAccountSuspended(client, account.userId, suspend);
  if (!r.ok) return NextResponse.json(apiError(r.error ?? "更新に失敗しました"), { status: 500 });
  await log(suspend ? "account_suspend" : "account_resume");
  return NextResponse.json(apiOk({}));
}
