/**
 * POST /api/admin/accounts
 *
 * 施設スタッフ / サービス提供者のログインアカウントを発行する（admin 専用）。
 * - auth.admin.createUser（email_confirm: false）でユーザー作成
 *   → profiles をロール・所属で昇格（handle_new_user トリガーが family で作成済み）
 *   → auth.admin.generateLink（type: 'invite'）で初回セットアップURLを取得
 * - セットアップURLは accountInvite テンプレートでメール送信。
 *   メール未設定（skipped）や失敗でもレスポンスに inviteUrl を含めるため、
 *   画面でURLをコピーして手渡しできる（運用が止まらない）。
 * - メール重複時は 409 / 途中失敗時は作成ユーザーを削除してロールバックする。
 * - 発行操作は activity_logs に記録する（監査）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/applications/server";
import { sendEmail } from "@/lib/email/send";
import { accountInvite } from "@/lib/email/templates";
import { logActivity } from "@/lib/audit/activity-log";
import { apiError, apiOk } from "@/types/api";
import { accountCreateSchema, PORTAL_NAMES } from "./schema";

/**
 * 所属先（施設 or 加盟店）が実在するか確認する。
 * @returns 見つかった場合はその名称、なければ null
 */
async function findTargetName(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  table: "facilities" | "merchants",
  id: string
): Promise<string | null> {
  const { data } = await admin
    .from(table)
    .select("id, name")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as { name: string } | null)?.name ?? null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), { status: 400 });
  }
  const parsed = accountCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.issues[0]?.message ?? "入力検証エラー", "VALIDATION_ERROR"),
      { status: 400 }
    );
  }
  const input = parsed.data;

  const admin = getSupabaseAdminClient();

  // 所属先の実在チェック（誤ったIDでの発行を防ぐ）
  const isFacility = input.role === "facility_staff";
  const targetTable = isFacility ? ("facilities" as const) : ("merchants" as const);
  const targetId = (isFacility ? input.facilityId : input.merchantId) as string;
  const targetName = await findTargetName(admin, targetTable, targetId);
  if (!targetName) {
    return NextResponse.json(
      apiError(isFacility ? "指定された施設が見つかりません" : "指定された提供者が見つかりません", "NOT_FOUND"),
      { status: 404 }
    );
  }

  // 1) auth ユーザー作成（メール確認は招待リンクで行うため未確認のまま）
  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: false,
    user_metadata: { display_name: input.displayName },
  });
  if (createErr || !createdUser?.user) {
    const msg = createErr?.message ?? "";
    if (createErr?.status === 422 || /already|registered|exists/i.test(msg)) {
      return NextResponse.json(
        apiError("このメールアドレスは既に登録されています", "EMAIL_EXISTS"),
        { status: 409 }
      );
    }
    return NextResponse.json(apiError("アカウントの作成に失敗しました", "CREATE_FAILED"), {
      status: 500,
    });
  }
  const userId = createdUser.user.id;

  // 2) profiles をロール・所属で昇格（トリガーが role=family で作成済み → 上書き）
  const { error: profErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      role: input.role,
      facility_id: isFacility ? targetId : null,
      merchant_id: isFacility ? null : targetId,
      display_name: input.displayName,
    },
    { onConflict: "id" }
  );
  if (profErr) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      apiError("プロフィールの設定に失敗しました。もう一度お試しください", "PROFILE_FAILED"),
      { status: 500 }
    );
  }

  // 3) 初回セットアップ（パスワード設定）用の招待リンクを生成
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qolc.jp";
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: { redirectTo: `${appUrl}/set-password` },
  });
  const inviteUrl = linkData?.properties?.action_link ?? null;
  if (linkErr || !inviteUrl) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      apiError("招待リンクの生成に失敗しました。もう一度お試しください", "LINK_FAILED"),
      { status: 500 }
    );
  }

  // 4) 案内メール送信（sendEmail は throw しない。skipped でも発行は成功）
  const portalName = PORTAL_NAMES[input.role];
  const tpl = accountInvite({
    recipientName: input.displayName,
    portalName,
    inviteUrl,
  });
  const emailResult = await sendEmail({ to: input.email, subject: tpl.subject, text: tpl.text });

  // 5) 監査ログ（既存 logActivity パターン。失敗しても本流は止めない）
  await logActivity({
    actorId: auth.user.id,
    action: "account_create",
    facilityId: isFacility ? targetId : null,
    targetType: "account",
    targetId: userId,
    targetLabel: `${input.displayName}（${input.email}）`,
    metadata: {
      role: input.role,
      target_table: targetTable,
      target_id: targetId,
      target_name: targetName,
      email_sent: emailResult.sent,
      email_skipped: emailResult.skipped,
    },
  });

  return NextResponse.json(
    apiOk({
      userId,
      email: input.email,
      role: input.role,
      portalName,
      targetName,
      inviteUrl,
      emailResult,
    })
  );
}
