/**
 * menu.ts の icon 名（文字列）→ Lucide コンポーネントのマッピング。
 * Sidebar / BottomNav で共有する。
 */
import {
  LayoutDashboard,
  Building2,
  Store,
  CreditCard,
  FileSpreadsheet,
  Database,
  Users,
  FileText,
  Stethoscope,
  Upload,
  Home,
  Receipt,
  History,
  Inbox,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

/** icon 名 → Lucide コンポーネント */
export const MENU_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  Store,
  CreditCard,
  FileSpreadsheet,
  Database,
  Users,
  FileText,
  Stethoscope,
  Upload,
  Home,
  Receipt,
  History,
  Inbox,
  ListChecks,
};
