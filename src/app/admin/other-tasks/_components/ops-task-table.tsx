"use client";

/**
 * その他業務タスクの一覧テーブル
 * 状態はセレクトで直接変更（対応中→完了など）。完了時は完了記録が残る。
 */
import { DataTable } from "@/components/shared/data-table";
import {
  ALL_OPS_STATUSES,
  OPS_STATUS_COLORS,
  OPS_STATUS_LABELS,
  type OpsTask,
  type OpsTaskStatus,
} from "@/lib/ops-tasks/logic";

/** ISO/日付 → "YYYY/MM/DD" */
function fmtDate(d: string | null): string {
  if (!d) return "—";
  return d.slice(0, 10).replace(/-/g, "/");
}

export interface OpsTaskTableProps {
  tasks: OpsTask[];
  assigneeNameOf: (id: string | null) => string;
  onStatusChange: (id: string, status: OpsTaskStatus) => void;
  todayStr: string;
}

export function OpsTaskTable({ tasks, assigneeNameOf, onStatusChange, todayStr }: OpsTaskTableProps) {
  return (
    <DataTable<OpsTask>
      rowKey={(t) => t.id}
      columns={[
        {
          key: "title",
          header: "タスク",
          render: (t) => (
            <div className="flex flex-col">
              <span className="font-medium">{t.title}</span>
              {t.note && (
                <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
                  {t.note}
                </span>
              )}
            </div>
          ),
        },
        {
          key: "category",
          header: "分類",
          render: (t) =>
            t.category ?? <span style={{ color: "var(--qolc-muted)" }}>—</span>,
        },
        {
          key: "status",
          header: "状態",
          render: (t) => {
            const c = OPS_STATUS_COLORS[t.status];
            return (
              <select
                aria-label={`${t.title} の状態`}
                className="text-sm rounded-full px-2 py-1 font-medium border-0 cursor-pointer"
                style={{ backgroundColor: c.bg, color: c.fg, minHeight: 32 }}
                value={t.status}
                onChange={(e) => onStatusChange(t.id, e.target.value as OpsTaskStatus)}
              >
                {ALL_OPS_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {OPS_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            );
          },
        },
        {
          key: "assignee",
          header: "担当",
          render: (t) => assigneeNameOf(t.assigneeId),
        },
        {
          key: "due",
          header: "期限",
          render: (t) => {
            const overdue =
              t.dueDate && t.dueDate < todayStr && t.status !== "done";
            return (
              <span
                className="num"
                style={overdue ? { color: "#DC2626", fontWeight: 700 } : undefined}
              >
                {fmtDate(t.dueDate)}
                {overdue ? "（超過）" : ""}
              </span>
            );
          },
        },
      ]}
      data={tasks}
    />
  );
}
