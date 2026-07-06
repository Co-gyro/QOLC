"use client";

/**
 * 「今日のUD」①マイタスク: 自分担当の業務タスク＋申請/相談を期限順に表示。
 * 「日々の運用（定例）」と「都度の対応（申請・相談ほか）」の2カテゴリに分けて示す。
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
  run: "業務チェック",
  application: "申請・相談",
};

/** カテゴリ見出しと説明（表示順もこの並び） */
const GROUPS: Array<{ key: MyTaskItem["group"]; title: string; description: string }> = [
  {
    key: "daily",
    title: "日々の運用",
    description: "精算・日次確認など、定期的に発生する定例業務です。",
  },
  {
    key: "adhoc",
    title: "都度の対応",
    description: "加盟店申請・住み替え相談など、案件ごとに発生する対応です。",
  },
];

function TaskRow({ t, todayStr }: { t: MyTaskItem; todayStr: string }) {
  return (
    <li>
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
  );
}

export function MyTasksSection({ items, todayStr }: MyTasksSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--qolc-text)" }}>
        マイタスク
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--qolc-muted)" }}>
        あなたが担当している進行中の仕事です（カテゴリ別・期限が近い順）。
      </p>
      {items.length === 0 ? (
        <EmptyState
          title="担当中のタスクはありません"
          description="業務チェックリストや申請の担当者にあなたが設定されると、ここに表示されます。"
        />
      ) : (
        <div className="flex flex-col gap-5">
          {GROUPS.map((g) => {
            const groupItems = items.filter((t) => t.group === g.key);
            if (groupItems.length === 0) return null;
            return (
              <div key={g.key}>
                <div className="flex items-baseline gap-2 mb-1">
                  <h3 className="text-base font-bold" style={{ color: "var(--qolc-text)" }}>
                    {g.title}
                  </h3>
                  <span className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                    {groupItems.length}件 — {g.description}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {groupItems.map((t) => (
                    <TaskRow key={`${t.type}-${t.id}`} t={t} todayStr={todayStr} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
