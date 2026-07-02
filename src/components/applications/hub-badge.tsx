/**
 * 申請/タスク ハブ専用の状態・優先度バッジ
 */
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  type ApplicationStatus,
  type ApplicationPriority,
} from "@/lib/applications/labels";

/** 状態バッジ */
export function StatusPill({ status }: { status: ApplicationStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/** 優先度バッジ（high は太字で強調） */
export function PriorityPill({ priority }: { priority: ApplicationPriority }) {
  const c = PRIORITY_COLORS[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs",
        priority === "high" ? "font-bold" : "font-medium"
      )}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
