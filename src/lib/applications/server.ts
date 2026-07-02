/**
 * 申請/タスク ハブ API のサーバー共通処理
 *
 * 既存の admin API（merchants）と同一の認証様式を踏襲する。
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/types";

/** admin 認証の結果。認可 OK のとき ok=true と user を返す。 */
export type AdminAuthResult =
  | { ok: true; user: User }
  | { ok: false; message: string; code: string; status: number };

/**
 * ログイン中ユーザーが admin であることを確認する。
 * app_metadata.role → profiles.role の順で判定（merchants API と同一）。
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "認証されていません", code: "UNAUTHORIZED", status: 401 };
  }
  const role =
    (user.app_metadata?.role as UserRole | undefined) ??
    ((await supabase.from("profiles").select("role").eq("id", user.id).single()).data?.role as
      | UserRole
      | undefined);
  if (role !== "admin") {
    return { ok: false, message: "管理者のみ実行できます", code: "FORBIDDEN", status: 403 };
  }
  return { ok: true, user };
}

/** UUID 形式チェック（merchants API と同一の正規表現） */
export function isUuid(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(id);
}
