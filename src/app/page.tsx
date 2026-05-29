/**
 * ルート (/) ハンドラ。
 * 認証状態とロールに応じて、それぞれのポータルダッシュボードへリダイレクトする。
 * - 未認証 → /login
 * - admin → /admin/dashboard
 * - facility_staff → /facility/dashboard
 * - provider → /provider/dashboard
 * - family → /user/home
 *
 * Phase 0 のモックアップダッシュボードは廃止（実データ駆動の各ポータルに移行）。
 */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  facility_staff: "/facility/dashboard",
  provider: "/provider/dashboard",
  family: "/user/home",
};

export default async function RootPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const appMetaRole = (user.app_metadata?.role as UserRole | undefined) ?? null;
  let role: UserRole | null = appMetaRole;
  if (!role) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = (profile?.role as UserRole | undefined) ?? null;
  }
  if (!role) {
    redirect("/login?error=no_profile");
  }

  redirect(ROLE_HOME[role]);
}
