/**
 * ポータル別サイドバーメニュー定義
 */
import type { PortalType } from "@/types";

export interface MenuItem {
  href: string;
  label: string;
  /** lucide-react のアイコン名（クライアント側で動的解決） */
  icon?: string;
}

export const PORTAL_MENUS: Record<PortalType, MenuItem[]> = {
  admin: [
    { href: "/admin/dashboard", label: "ダッシュボード", icon: "LayoutDashboard" },
    { href: "/admin/applications", label: "申請・タスク", icon: "Inbox" },
    { href: "/admin/facilities", label: "介護施設管理", icon: "Building2" },
    { href: "/admin/merchants", label: "加盟店管理", icon: "Store" },
    { href: "/admin/payments", label: "決済管理", icon: "CreditCard" },
    { href: "/admin/csv-tools", label: "データ変換", icon: "FileSpreadsheet" },
    { href: "/admin/logs", label: "操作ログ", icon: "History" },
    { href: "/admin/master", label: "マスタ管理", icon: "Database" },
  ],
  facility: [
    { href: "/facility/dashboard", label: "ダッシュボード", icon: "LayoutDashboard" },
    { href: "/facility/residents", label: "入居者管理", icon: "Users" },
    { href: "/facility/statements", label: "明細管理", icon: "FileText" },
    { href: "/facility/payments", label: "決済状況", icon: "CreditCard" },
    { href: "/facility/providers", label: "サービス提供者", icon: "Stethoscope" },
    { href: "/facility/logs", label: "操作ログ", icon: "History" },
  ],
  provider: [
    { href: "/provider/dashboard", label: "ダッシュボード", icon: "LayoutDashboard" },
    { href: "/provider/upload", label: "明細アップロード", icon: "Upload" },
    { href: "/provider/facilities", label: "取引先施設", icon: "Building2" },
  ],
  user: [
    { href: "/user/home", label: "ホーム", icon: "Home" },
    { href: "/user/statements", label: "ご利用明細", icon: "FileText" },
    { href: "/user/receipts", label: "領収書", icon: "Receipt" },
    { href: "/user/card", label: "カード管理", icon: "CreditCard" },
  ],
};

export const PORTAL_LABELS: Record<PortalType, string> = {
  admin: "運営センター",
  facility: "施設ステーション",
  provider: "サービスステーション",
  user: "マイページ",
};

/** ポータル別のキャッチコピー（ダッシュボードのウェルカム見出し用） */
export const PORTAL_TAGLINES: Record<PortalType, string> = {
  admin: "全体の状況把握とマスタ管理ができます",
  facility: "入居者さまの管理と決済状況の確認ができます",
  provider: "サービス利用明細のアップロードと決済ができます",
  user: "ご利用明細・領収書の確認とカード管理ができます",
};
