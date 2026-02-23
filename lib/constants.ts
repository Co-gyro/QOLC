// ==========================================
// QOLC - 定数定義（設計書 v2 準拠）
// ==========================================

export const APP_NAME = "QOLC";
export const APP_DESCRIPTION = "介護施設向け利用明細・領収書発行サービス";

// --- ロール ---

export const USER_ROLE_LABELS: Record<string, string> = {
  admin: "運営者",
  provider: "サービス提供者",
  facility: "介護施設",
  resident_family: "入居者・家族",
};

// --- 運営者ロール ---

export const OPERATOR_ROLE_LABELS: Record<string, string> = {
  super_admin: "全権限",
  admin: "管理権限",
  viewer: "閲覧のみ",
};

export const OPERATOR_ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800",
  admin: "bg-purple-100 text-purple-800",
  viewer: "bg-gray-100 text-gray-800",
};

export const OPERATOR_STATUS_LABELS: Record<string, string> = {
  active: "有効",
  inactive: "無効",
};

export const OPERATOR_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
};

// --- 決済ステータス ---

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "決済待ち",
  processing: "処理中",
  completed: "決済完了",
  failed: "決済失敗",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

// --- サービス種別 ---

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  medical: "訪問診療",
  nursing: "訪問看護",
  care: "介護",
  dental: "訪問歯科",
  pharmacy: "訪問調剤薬局",
  taxi: "タクシー",
  shopping: "買い物代行",
  other: "その他",
};

// --- 加盟店ステータス ---

export const MERCHANT_STATUS_LABELS: Record<string, string> = {
  active: "有効",
  inactive: "無効",
  pending: "審査中",
};

export const MERCHANT_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  pending: "bg-yellow-100 text-yellow-800",
};

// --- 通知ステータス ---

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  statement: "明細",
  receipt: "領収書",
  system: "システム",
};

export const NOTIFICATION_TYPE_COLORS: Record<string, string> = {
  statement: "bg-blue-100 text-blue-800",
  receipt: "bg-purple-100 text-purple-800",
  system: "bg-gray-100 text-gray-800",
};

export const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  pending: "送信待ち",
  sent: "送信済み",
  failed: "送信失敗",
};

// --- ナビゲーション ---

export const NAV_ITEMS = [
  { label: "ダッシュボード", href: "/", icon: "home" },
  { label: "介護施設管理", href: "/facilities", icon: "hospital" },
  { label: "加盟店管理", href: "/merchants", icon: "building" },
  { label: "運営者管理", href: "/operators", icon: "users" },
  { label: "決済管理", href: "/payments", icon: "credit-card" },
  { label: "領収書管理", href: "/receipts", icon: "receipt" },
  { label: "通知管理", href: "/notifications", icon: "bell" },
  { label: "マスタ管理", href: "/master", icon: "settings" },
] as const;

// --- Facility ナビゲーション ---

export const FACILITY_NAV_ITEMS = [
  { label: "ダッシュボード", href: "/facility", icon: "home" },
  { label: "入居者管理", href: "/facility/residents", icon: "residents" },
  { label: "サービス提供者管理", href: "/facility/providers", icon: "providers" },
  { label: "明細確認", href: "/facility/statements", icon: "statements" },
  { label: "スタッフ管理", href: "/facility/staff", icon: "staff" },
  { label: "設定", href: "/facility/settings", icon: "settings" },
] as const;

// --- Provider ナビゲーション ---

export const PROVIDER_NAV_ITEMS = [
  { label: "ダッシュボード", href: "/provider", icon: "home" },
  { label: "明細アップロード", href: "/provider/upload", icon: "upload" },
  { label: "アップロード履歴", href: "/provider/history", icon: "history" },
  { label: "設定", href: "/provider/settings", icon: "settings" },
] as const;

// --- アップロードステータス ---

export const UPLOAD_STATUS_LABELS: Record<string, string> = {
  processing: "処理中",
  completed: "完了",
  partial_error: "一部エラー",
  error: "エラー",
};

export const UPLOAD_STATUS_COLORS: Record<string, string> = {
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  partial_error: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
};

// --- 入居者ステータス ---

export const RESIDENT_STATUS_LABELS: Record<string, string> = {
  active: "入居中",
  discharged: "退去済み",
};

export const RESIDENT_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  discharged: "bg-gray-100 text-gray-800",
};

// --- 通知方法ステータス ---

export const NOTIFY_STATUS_LABELS: Record<string, string> = {
  pending: "未通知",
  sent: "通知済み",
  failed: "通知失敗",
};

export const NOTIFY_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

// --- その他 ---

export const ITEMS_PER_PAGE = 20;

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ordinary: "普通",
  current: "当座",
};
