"use client";

/**
 * 加盟店一覧の「関連案件」セル。
 * 元申請（applications）と業務タスク（workflow_runs）へのリンクを縦に並べて示し、
 * 加盟店管理から各業務タスク・申請ハブへ直接たどれるようにする。
 */
import Link from "next/link";
import { SOURCE_LABELS, STATUS_LABELS } from "@/lib/applications/labels";
import type { MerchantRelations } from "@/lib/portal/merchant-relations";

const RUN_STATUS_LABELS: Record<string, string> = {
  open: "進行中",
  done: "完了",
  canceled: "中止",
};

export function RelationsCell({ relations }: { relations: MerchantRelations | null }) {
  if (!relations || (relations.applications.length === 0 && relations.runs.length === 0)) {
    return <span style={{ color: "var(--qolc-muted)" }}>—</span>;
  }
  return (
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      {relations.applications.map((a) => (
        <Link
          key={a.id}
          href={`/admin/applications/${a.id}`}
          className="text-sm underline"
          style={{ color: "var(--qolc-primary)" }}
        >
          {SOURCE_LABELS[a.source]}（{STATUS_LABELS[a.status]}）
        </Link>
      ))}
      {relations.runs.map((r) => (
        <Link
          key={r.id}
          href={`/admin/tasks/${r.id}`}
          className="text-sm underline"
          style={{ color: "var(--qolc-primary)" }}
        >
          {r.title}（{RUN_STATUS_LABELS[r.status] ?? r.status}）
        </Link>
      ))}
    </div>
  );
}
