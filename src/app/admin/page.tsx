import { redirect } from "next/navigation";

/**
 * 管理者ポータルのインデックスページ。
 * qolc.jp ヘッダーの「管理者ログイン」等から `/admin` に直接アクセスされた際、
 * ダッシュボードへリダイレクトする（page.tsx が無いと 404 になるため）。
 */
export default function AdminIndexPage(): never {
  redirect("/admin/dashboard");
}
