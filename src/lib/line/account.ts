/**
 * LINE アカウントと Supabase auth ユーザーの紐付け（サーバー専用）。
 *
 * LINE Login は Supabase ネイティブ未対応のため、OIDC で本人確認した上で
 *   1. profiles.line_user_id をキーに既存ユーザーを検索（再ログイン）
 *   2. なければ招待トークン経由でのみ新規作成（家族アカウントは招待制）
 * という get-or-create を service_role 権限で行う。
 *
 * 機微情報（line_user_id）の書き込みは本モジュール（service_role）からのみ。
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** LINE ユーザー用の内部メールアドレス（実際の送信はしない非ルータブルドメイン） */
const LINE_EMAIL_DOMAIN = "line.qolc.local";

/**
 * LINE userId（sub）から Supabase ユーザー用の内部メールアドレスを生成する。
 * magiclink ベースのセッション確立にメールが必要なため、決定的な合成値を用いる。
 */
export function syntheticLineEmail(lineUserId: string): string {
  // sub は英数字（U + 32hex）。念のため安全な文字のみに正規化
  const safe = lineUserId.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `line_${safe}@${LINE_EMAIL_DOMAIN}`;
}

/** LINE 連携結果 */
export interface LineLinkResult {
  /** Supabase auth ユーザーID */
  userId: string;
  /** セッション確立に使う（合成）メールアドレス */
  email: string;
  /** 新規作成だったか（既存ログインなら false） */
  created: boolean;
}

/**
 * line_user_id で既存プロフィールを検索し、対応する auth ユーザー情報を返す。
 * @returns 見つからなければ null
 */
export async function findUserByLineId(
  admin: SupabaseClient,
  lineUserId: string
): Promise<{ userId: string; email: string } | null> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return { userId: data.id as string, email: syntheticLineEmail(lineUserId) };
}

/**
 * LINE ユーザー用の Supabase auth ユーザーを新規作成し、profiles.line_user_id を設定する。
 * profiles 行は handle_new_user トリガーで作成されるため、line_user_id / display_name を更新する。
 * @param displayName LINE プロフィール名（任意）
 */
export async function createLineUser(
  admin: SupabaseClient,
  lineUserId: string,
  displayName?: string
): Promise<{ userId: string; email: string }> {
  const email = syntheticLineEmail(lineUserId);
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName || "LINEユーザー", line_login: true },
  });
  if (error || !created.user) {
    throw new Error(`LINE ユーザー作成に失敗しました: ${error?.message ?? "unknown"}`);
  }
  const userId = created.user.id;

  const { error: profErr } = await admin
    .from("profiles")
    .update({ line_user_id: lineUserId, display_name: displayName || "LINEユーザー" })
    .eq("id", userId);
  if (profErr) {
    // ロールバック（line_user_id ユニーク衝突など）
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`LINE 連携情報の保存に失敗しました: ${profErr.message}`);
  }

  return { userId, email };
}
