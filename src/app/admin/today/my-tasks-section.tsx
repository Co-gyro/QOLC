"use client";

/**
 * 「今日のUD」①マイタスク: 自分担当の業務タスク＋申請/相談を期限順に表示
 */
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { fmtDate } from "@/lib/portal/workflow-client";
import { isOverdue } from "@/lib/portal/workflow-logic";
import type { MyTaskItem } from "@/lib/portal/today-queries";

export interface MyTasksSectionProps {
  items: MyTaskItem[];
  todayStr: string;
}

const TYPE_LABELS: Record<MyTaskItem["type"], string> = {
  run: "業務タスク",
  application: "申請・相談",
};

export function MyTasksSection({ items, todayStr }: MyTasksSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--qolc-text)" }}>
        マイタスク
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--qolc-muted)" }}>
        あなたが担当している進行中の仕事です（期限が近い順）。
      </p>
      {items.length === 0 ? (
        <EmptyState
          title="担当中のタスクはありません"
          description="業務タスクや申請の担当者にあなたが設定されると、ここに表示されます。"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((t) => (
            <li key={`${t.type}-${t.id}`}>
              <Link
                href={t.href}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border rounded-md px-4 py-3 min-h-[44px] hover:bg-gray-50"
                style={{ borderColor: "var(--qolc-border)" }}
              >
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ backgroundColor: "var(--qolc-bg-soft)", color: "var(--qolc-primary)" }}
                >
                  {TYPE_LABELS[t.type]}
                </span>
                <span className="font-medium flex-1 min-w-[160px]" style={{ color: "var(--qolc-text)" }}>
                  {t.title}
                </span>
                <span className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                  {t.detail}
                </span>
                <span
                  className="text-sm font-medium"
                  style={{
                    color: isOverdue(t.dueDate, todayStr) ? "#DC2626" : "var(--qolc-muted)",
                  }}
                >
                  期限 {fmtDate(t.dueDate)}
                  {isOverdue(t.dueDate, todayStr) && "（超過）"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
