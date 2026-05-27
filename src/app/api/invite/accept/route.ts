/**
 * POST /api/invite/accept
 *
 * 招待を受諾して家族アカウントを作成（公開）。
 * - トークン検証（有効・未使用・未期限切れ）
 * - メール+PW で auth ユーザー作成
 * - resident_account を作成して入居者に紐付け（is_payment_owner は招待の設定）
 * - 招待を used_at に更新
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";

const bodySchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "パスワードは8文字以上"),
  displayName: z.string().trim().max(50).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.issues[0]?.message ?? "入力検証エラー", "VALIDATION_ERROR"),
      { status: 400 }
    );
  }
  const { token, email, password, displayName } = parsed.data;

  const admin = getSupabaseAdminClient();

  // トークン検証
  const { data: inv } = await admin
    .from("invitations")
    .select("id, resident_id, account_type, is_payment_owner, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (!inv) {
    return NextResponse.json(apiError("招待が見つかりません", "NOT_FOUND"), { status: 404 });
  }
  if (inv.used_at) {
    return NextResponse.json(apiError("この招待は既に使用されています", "USED"), { status: 410 });
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return NextResponse.json(apiError("この招待は有効期限が切れています", "EXPIRED"), { status: 410 });
  }

  // 支払いオーナー招待の場合、二重を再チェック
  if (inv.is_payment_owner) {
    const { data: owner } = await admin
      .from("resident_accounts")
      .select("id")
      .eq("resident_id", inv.resident_id)
      .eq("is_payment_owner", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (owner) {
      return NextResponse.json(
        apiError("この入居者には既に支払い担当者が登録されています", "OWNER_EXISTS"),
        { status: 409 }
      );
    }
  }

  // ユーザー作成（メール確認済みで作成）
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName || email },
  });
  if (userErr || !created.user) {
    const msg = userErr?.message ?? "ユーザー作成に失敗しました";
    // 既存メール等
    return NextResponse.json(apiError(`登録に失敗しました: ${msg}`, "SIGNUP_FAILED"), {
      status: 409,
    });
  }
  const userId = created.user.id;

  // profile は handle_new_user トリガーで作成済み（role=family）

  // resident_account 作成
  const { error: raErr } = await admin.from("resident_accounts").insert({
    resident_id: inv.resident_id,
    user_id: userId,
    type: inv.account_type,
    is_payment_owner: inv.is_payment_owner,
    notification_method: "email",
  });
  if (raErr) {
    // 作成したユーザーをロールバック削除
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      apiError(`アカウント紐付けに失敗しました: ${raErr.message}`, "LINK_FAILED"),
      { status: 500 }
    );
  }

  // 招待を使用済みに
  await admin.from("invitations").update({ used_at: new Date().toISOString() }).eq("id", inv.id);

  return NextResponse.json(apiOk({ email }));
}
