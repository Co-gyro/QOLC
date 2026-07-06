"use client";

/**
 * 住み替え相談／お問い合わせ・サポートタブの汎用一覧テーブル。
 * （加盟店申請タブはステージ別リスト merchant-stage-list を使う）
 */
import { DataTable } from "@/components/shared/data-table";
import { StatusPill, PriorityPill } from "@/components/applications/hub-badge";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import type { ApplicationRow } from "@/lib/applications/types";

/** ISO 日時 → "YYYY/MM/DD" */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

export interface GenericAppTableProps {
  rows: ApplicationRow[];
  /** お問い合わせ・サポートタブでは種別列を出す */
  showSource: boolean;
  onSelect: (id: string) => void;
}

export function GenericAppTable({ rows, showSource, onSelect }: GenericAppTableProps) {
  return (
    <DataTable<ApplicationRow>
      rowKey={(r) => r.id}
      onRowClick={(r) => onSelect(r.id)}
      columns={[
        ...(showSource
          ? [
              {
                key: "source",
                header: "種別",
                render: (r: ApplicationRow) => SOURCE_LABELS[r.source],
              },
            ]
          : []),
        {
          key: "applicant",
          header: "申請者",
          render: (r) => (
            <div className="flex flex-col">
              <span className="font-medium">{r.applicantName ?? "—"}</span>
              {r.applicantOrg && (
                <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
                  {r.applicantOrg}
                </span>
              )}
            </div>
          ),
        },
        { key: "status", header: "状態", render: (r) => <StatusPill status={r.status} /> },
        {
          key: "priority",
          header: "優先度",
          render: (r) => <PriorityPill priority={r.priority} />,
        },
        {
          key: "assignee",
          header: "担当者",
          render: (r) =>
            r.assigneeName ?? <span style={{ color: "var(--qolc-muted)" }}>未割当</span>,
        },
        { key: "due", header: "期限", render: (r) => fmtDate(r.dueDate) },
        {
          key: "next",
          header: "次アクション",
          render: (r) =>
            r.nextAction ? (
              <span className="font-medium" style={{ color: "var(--qolc-primary)" }}>
                {r.nextAction}
              </span>
            ) : (
              <span style={{ color: "var(--qolc-muted)" }}>—</span>
            ),
        },
        { key: "created", header: "受付日", render: (r) => fmtDate(r.createdAt) },
      ]}
      data={rows}
    />
  );
}
