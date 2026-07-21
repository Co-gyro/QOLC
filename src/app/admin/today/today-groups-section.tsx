"use client";

/**
 * 「今日のUD」業務別グループ表示（v2・業務ファースト構成）
 *
 * 各グループ＝サイドバーの業務に対応。行クリックで該当業務ページの案件へ遷移する
 * （ポップアップは使わない）。組み立ては today-groups.ts の純関数が担当。
 */
import Link from "next/link";
import type { TodayGroup, TodayItemTone } from "@/lib/portal/today-groups";

/** バッジ配色（tone 別） */
const TONE_COLORS: Record<TodayItemTone, { bg: string; fg: string }> = {
  new: { bg: "#FCF1E3", fg: "#B45309" },
  doing: { bg: "#E6F4EA", fg: "#1B5E20" },
  alert: { bg: "#FEE2E2", fg: "#991B1B" },
  calm: { bg: "#F3F4F6", fg: "#4B5563" },
};

export interface TodayGroupsSectionProps {
  groups: TodayGroup[];
}

export function TodayGroupsSection({ groups }: TodayGroupsSectionProps) {
  return (
    <div className="flex flex-col gap-4 mb-8">
      {groups.map((g) => {
        // 「その他業務」は該当があるときだけ出す（通常は空）
        if (g.key === "other" && g.items.length === 0) return null;
        return (
          <section
            key={g.key}
            className="border rounded-lg overflow-hidden"
            style={{ borderColor: "var(--qolc-border)" }}
          >
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ backgroundColor: "var(--qolc-bg-soft)" }}
            >
              <h2 className="font-bold" style={{ color: "var(--qolc-text)" }}>
                {g.label}
              </h2>
              <span className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                {g.items.length === 0
                  ? "今日の対応はありません"
                  : `要対応 ${g.items.length + g.extraCount} 件`}
              </span>
              <Link
                href={g.href}
                className="ml-auto text-sm font-medium hover:underline"
                style={{ color: "var(--qolc-primary)" }}
              >
                一覧へ →
              </Link>
            </div>
            {g.items.map((item) => {
              const c = TONE_COLORS[item.badge.tone];
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 min-h-[44px] border-t hover:bg-gray-50"
                  style={{ borderColor: "var(--qolc-border)" }}
                >
                  <span
                    className="text-sm px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: c.bg, color: c.fg }}
                  >
                    {item.badge.label}
                  </span>
                  <span
                    className="font-medium min-w-[160px]"
                    style={{ color: "var(--qolc-text)" }}
                  >
                    {item.title}
                  </span>
                  <span className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                    {item.sub}
                  </span>
                  <span
                    className="ml-auto text-sm font-medium shrink-0"
                    style={{ color: "var(--qolc-primary)" }}
                  >
                    開く →
                  </span>
                </Link>
              );
            })}
            {g.extraCount > 0 && (
              <Link
                href={g.href}
                className="block px-4 py-2.5 text-sm border-t hover:bg-gray-50"
                style={{ borderColor: "var(--qolc-border)", color: "var(--qolc-muted)" }}
              >
                ほか {g.extraCount} 件 — 一覧で見る →
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}
