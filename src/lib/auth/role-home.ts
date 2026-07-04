import type { UserRole } from "@/types";

/**
 * ロール → ログイン後のホーム画面パスの対応表。
 * ログイン・初期パスワード設定など、認証完了後の遷移先を一元管理する。
 */
export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  facility_staff: "/facility/dashboard",
  provider: "/provider/dashboard",
  family: "/user/home",
};
