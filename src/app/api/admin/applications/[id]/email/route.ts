/**
 * POST /api/admin/applications/[id]/email
 *
 * 申請者へ定型メール（現状は審査通過のご案内のみ）を送信する。
 * - sendEmail は絶対に throw しない（キー未設定時は skipped=true）
 * - 送信結果は成功/スキップ/失敗を問わず application_events（kind='email_sent'）へ記録する
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import { sendEmail } from "@/lib/email/send";
import { reviewApproved } from "@/lib/email/templates";
import { apiError, apiOk } from "@/types/api";

const bodySchema = z.object({
  template: z.enum(["review_approved"]),
});

/** 定型メールを1通送信し、結果をタイムラインに記録する */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: app, error: appErr } = await admin
    .from("applications")
    .select("id, applicant_name, applicant_org, applicant_email, payload")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (appErr) {
    return NextResponse.json(apiError(`取得に失敗しました: ${appErr.message}`, "DB"), {
      status: 500,
    });
  }
  if (!app) {
    return NextResponse.json(apiError("申請が見つかりません", "NOT_FOUND"), { status: 404 });
  }
  const application = app as {
    id: string;
    applicant_name: string | null;
    applicant_org: string | null;
    applicant_email: string | null;
    payload: Record<string, unknown> | null;
  };
  if (!application.applicant_email) {
    return NextResponse.json(
      apiError("申請者のメールアドレスが登録されていないため送信できません", "NO_EMAIL"),
      { status: 400 }
    );
  }

  // 加盟店名は施設名（payload.facilityName）を優先、なければ所属
  const facilityName =
    typeof application.payload?.facilityName === "string"
      ? application.payload.facilityName
      : null;
  const mail = reviewApproved({
    applicantName: application.applicant_name,
    merchantName: facilityName ?? application.applicant_org,
    caseNumber: application.id.slice(0, 8).toUpperCase(),
  });

  const result = await sendEmail({
    to: application.applicant_email,
    subject: mail.subject,
    text: mail.text,
  });

  // 成功・スキップ・失敗を問わず記録する（監査要件）
  const { error: evErr } = await admin.from("application_events").insert({
    application_id: params.id,
    actor_id: auth.user.id,
    kind: "email_sent",
    detail: {
      template: parsed.data.template,
      to: application.applicant_email,
      subject: mail.subject,
      result,
    },
  });
  if (evErr) {
    return NextResponse.json(apiError(`履歴の記録に失敗しました: ${evErr.message}`, "DB"), {
      status: 500,
    });
  }

  return NextResponse.json(
    apiOk({
      sent: result.sent,
      skipped: result.skipped,
      to: application.applicant_email,
      ...(result.error ? { error: result.error } : {}),
    })
  );
}
