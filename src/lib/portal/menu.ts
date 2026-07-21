/**
 * ポータル別サイドバーメニュー定義
 *
 * admin は「業務ファースト」構成（2026-07-21 合意）:
 * 上段=業務（今日のUD＋実際に作業する画面）、下段=台帳・ツール（参照・設定）。
 * サイドバーはセクション見出し付きで描画し、モバイルの BottomNav は
 * フラット化した PORTAL_MENUS を使う（業務セクションが先頭に来る）。
 */
import type { PortalType } from "@/types";

export interface MenuItem {
  href: string;
  label: string;
  /** lucide-react のアイコン名（クライアント側で動的解決） */
  icon?: string;
}

/** サイドバーの1セクション（title なしは見出しを描画しない） */
export interface MenuSection {
  title?: string;
  items: MenuItem[];
}

export const PORTAL_MENU_SECTIONS: Record<PortalType, MenuSection[]> = {
  admin: [
    {
      items: [{ href: "/admin/today", label: "今日のUD", icon: "Home" }],
    },
    {
      title: "業務",
      items: [
        { href: "/admin/inquiries", label: "相談・問い合わせ", icon: "Inbox" },
        { href: "/admin/applications", label: "加盟店申請・登録", icon: "Store" },
        { href: "/admin/payments", label: "日次決済", icon: "CreditCard" },
        { href: "/admin/tasks", label: "月次精算・チェック", icon: "ListChecks" },
        { href: "/admin/other-tasks", label: "その他業務", icon: "ClipboardCheck" },
      ],
    },
    {
      title: "台帳・ツール",
      items: [
        { href: "/admin/dashboard", label: "ダッシュボード", icon: "LayoutDashboard" },
        { href: "/admin/facilities", label: "介護施設", icon: "Building2" },
        { href: "/admin/merchants", label: "加盟店", icon: "Database" },
        { href: "/admin/csv-tools", label: "精算CSV変換", icon: "FileSpreadsheet" },
        { href: "/admin/logs", label: "操作ログ", icon: "History" },
        { href: "/admin/master", label: "マスタ管理", icon: "Users" },
      ],
    },
  ],
  facility: [
    {
      items: [
        { href: "/facility/dashboard", label: "ダッシュボード", icon: "LayoutDashboard" },
        { href: "/facility/residents", label: "入居者管理", icon: "Users" },
        { href: "/facility/statements", label: "明細管理", icon: "FileText" },
        { href: "/facility/payments", label: "決済状況", icon: "CreditCard" },
        { href: "/facility/providers", label: "サービス提供者", icon: "Stethoscope" },
        { href: "/facility/logs", label: "操作ログ", icon: "History" },
      ],
    },
  ],
  provider: [
    {
      items: [
        { href: "/provider/dashboard", label: "ダッシュボード", icon: "LayoutDashboard" },
        { href: "/provider/upload", label: "明細アップロード", icon: "Upload" },
        { href: "/provider/facilities", label: "取引先施設", icon: "Building2" },
      ],
    },
  ],
  user: [
    {
      items: [
        { href: "/user/home", label: "ホーム", icon: "Home" },
        { href: "/user/statements", label: "ご利用明細", icon: "FileText" },
        { href: "/user/receipts", label: "領収書", icon: "Receipt" },
        { href: "/user/card", label: "カード管理", icon: "CreditCard" },
      ],
    },
  ],
};

/** セクションをフラット化した互換ビュー（BottomNav 等で使用） */
export const PORTAL_MENUS: Record<PortalType, MenuItem[]> = {
  admin: PORTAL_MENU_SECTIONS.admin.flatMap((s) => s.items),
  facility: PORTAL_MENU_SECTIONS.facility.flatMap((s) => s.items),
  provider: PORTAL_MENU_SECTIONS.provider.flatMap((s) => s.items),
  user: PORTAL_MENU_SECTIONS.user.flatMap((s) => s.items),
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
