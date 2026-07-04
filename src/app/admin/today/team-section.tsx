"use client";

/**
 * 「今日のUD」④チーム状況: admin 担当者ごとの対応中件数（誰が今なにをしているか）
 */
import type { TeamStatus } from "@/lib/portal/today-queries";

export interface TeamSectionProps {
  team: TeamStatus;
}

export function TeamSection({ team }: TeamSectionProps) {
  const hasUnassigned = team.unassigned.applicationCount > 0 || team.unassigned.runCount > 0;
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--qolc-text)" }}>
        チーム状況
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--qolc-muted)" }}>
        担当者ごとの「対応中の申請」「進行中の業務タスク」の件数です。
      </p>
      <div className="overflow-x-auto border rounded-md" style={{ borderColor: "var(--qolc-border)" }}>
        <table className="min-w-full text-sm">
          <thead style={{ backgroundColor: "var(--qolc-bg-soft)" }}>
            <tr>
              <th className="px-4 py-3 text-left font-semibold">担当者</th>
              <th className="px-4 py-3 text-right font-semibold">対応中の申請</th>
              <th className="px-4 py-3 text-right font-semibold">進行中タスク</th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((m) => (
              <tr key={m.id} className="border-t" style={{ borderColor: "var(--qolc-border)" }}>
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{m.applicationCount} 件</td>
                <td className="px-4 py-3 text-right tabular-nums">{m.runCount} 件</td>
              </tr>
            ))}
            {hasUnassigned && (
              <tr className="border-t" style={{ borderColor: "var(--qolc-border)" }}>
                <td className="px-4 py-3" style={{ color: "#B45309" }}>
                  未割当（担当者を決めてください）
                </td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#B45309" }}>
                  {team.unassigned.applicationCount} 件
                </td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#B45309" }}>
                  {team.unassigned.runCount} 件
                </td>
              </tr>
            )}
            {team.members.length === 0 && !hasUnassigned && (
              <tr className="border-t" style={{ borderColor: "var(--qolc-border)" }}>
                <td className="px-4 py-3" colSpan={3} style={{ color: "var(--qolc-muted)" }}>
                  表示できる担当者がいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
