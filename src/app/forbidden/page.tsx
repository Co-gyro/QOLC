import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/auth/role-home";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

/** ロールの表示名 */
const ROLE_LABEL: Record<UserRole, string> = {
  admin: "運営（管理者）",
  facility_staff: "介護施設",
  provider: "サービス提供者",
  family: "ご家族",
  udpay_merchant: "UD Payment 利用者",
};

/**
 * 権限のない画面を開いたときの案内（middleware が 403 でここを表示する）。
 * 多くは別の役割のアカウントでログインしたままのため、今のアカウントとログアウトの導線を出す。
 */
export default async function ForbiddenPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata?.role as UserRole | undefined) ?? null;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7F5] px-4 text-[#333333]">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-[#E0DDD8] bg-white p-6">
        <h1 className="text-xl font-bold">このアカウントでは開けない画面です</h1>
        {user ? (
          <p className="text-base">
            いまログインしているのは <strong>{user.email}</strong>
            {role ? `（${ROLE_LABEL[role]}）` : ""} です。別のアカウントで開く場合は、いったんログアウトしてからログインし直してください。
          </p>
        ) : (
          <p className="text-base">ログインし直してください。</p>
        )}
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="min-h-[48px] w-full rounded bg-[#4C986A] text-base font-bold text-white hover:bg-[#3D7A55]">
            ログアウトして別のアカウントでログイン
          </button>
        </form>
        {role && (
          <Link href={ROLE_HOME[role]} className="block text-center text-base text-[#3D7A55] underline">
            このアカウントのホーム画面へ戻る
          </Link>
        )}
      </div>
    </main>
  );
}
