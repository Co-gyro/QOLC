import { cn } from "@/lib/utils";
import type { PaymentStatus, MerchantAppStatus, MatchStatus } from "@/types";

export type AnyStatus =
  | PaymentStatus
  | MerchantAppStatus
  | MatchStatus
  | "active"
  | "inactive";

const LABEL_MAP: Record<string, string> = {
  pending: "保留",
  authorized: "与信済",
  captured: "完了",
  failed: "失敗",
  cancelled: "取消",
  refunded: "返金",
  reviewing: "審査中",
  approved: "承認",
  rejected: "却下",
  matched: "一致",
  unmatched: "未一致",
  ambiguous: "曖昧",
  active: "有効",
  inactive: "無効",
};

const COLOR_MAP: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#FFF7E6", fg: "#B45309" },
  authorized: { bg: "#E0F2FE", fg: "#0369A1" },
  captured: { bg: "#E6F4EA", fg: "#1B5E20" },
  failed: { bg: "#FEE2E2", fg: "#991B1B" },
  cancelled: { bg: "#F3F4F6", fg: "#4B5563" },
  refunded: { bg: "#FAE8FF", fg: "#86198F" },
  reviewing: { bg: "#FFF7E6", fg: "#B45309" },
  approved: { bg: "#E6F4EA", fg: "#1B5E20" },
  rejected: { bg: "#FEE2E2", fg: "#991B1B" },
  matched: { bg: "#E6F4EA", fg: "#1B5E20" },
  unmatched: { bg: "#FEE2E2", fg: "#991B1B" },
  ambiguous: { bg: "#FFF7E6", fg: "#B45309" },
  active: { bg: "#E6F4EA", fg: "#1B5E20" },
  inactive: { bg: "#F3F4F6", fg: "#4B5563" },
};

export interface StatusBadgeProps {
  status: AnyStatus | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = LABEL_MAP[status] ?? status;
  const color = COLOR_MAP[status] ?? { bg: "#F3F4F6", fg: "#4B5563" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        className
      )}
      style={{ backgroundColor: color.bg, color: color.fg }}
    >
      {label}
    </span>
  );
}
