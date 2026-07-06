"use client";

/**
 * 「今日のUD」②新着・未対応: status=new の申請/相談
 */
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import { fmtDate } from "@/lib/portal/workflow-client";
import type { TodayApplication } from "@/lib/portal/today-queries";

export interface NewAppsSectionProps {
  apps: TodayApplication[];
}

export function NewAppsSection({ apps }: NewAppsSectionProps) {
  const newApps = apps.filter((a) => a.status === "new");
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold" style={{ color: "var(--qolc-text)" }}>
          新着・未対応の申請
        </h2>
        <Link
          href="/admin/applications"
          className="text-sm font-medium hover:underline"
          style={{ color: "var(--qolc-primary)" }}
        >
          申請・相談の一覧へ →
        </Link>
      </div>
      <p className="text-sm mb-3" style={{ color: "var(--qolc-muted)" }}>
        まだ誰も着手していない受付分です。内容を確認して担当者を決めてください。
      </p>
      {newApps.length === 0 ? (
        <EmptyState
          title="未対応の新着はありません"
          description="公開フォームなどから申請が届くと、ここに表示されます。"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {newApps.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/applications?open=${a.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border rounded-md px-4 py-3 min-h-[44px] hover:bg-gray-50"
                style={{ borderColor: "var(--qolc-border)" }}
              >
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ backgroundColor: "#E0F2FE", color: "#0369A1" }}
                >
                  {SOURCE_LABELS[a.source]}
                </span>
                <span className="font-medium flex-1 min-w-[160px]" style={{ color: "var(--qolc-text)" }}>
                  {a.applicantName ?? a.applicantOrg ?? "（申請者不明）"}
                </span>
                <span className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                  受付 {fmtDate(a.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
