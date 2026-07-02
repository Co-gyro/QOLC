"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill, PriorityPill } from "@/components/applications/hub-badge";
import { DetailDrawer } from "@/components/applications/detail-drawer";
import { ApplicationFilters } from "@/components/applications/list-filters";
import {
  fetchApplications,
  fetchAssignees,
  type ApplicationFilters as Filters,
} from "@/lib/applications/client";
import { SOURCE_LABELS, OPEN_STATUSES } from "@/lib/applications/labels";
import type { ApplicationRow, AssigneeOption } from "@/lib/applications/types";

/** ISO 日時 → "YYYY/MM/DD" */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

export default function AdminApplicationsPage() {
  const [rows, setRows] = useState<ApplicationRow[] | null>(null);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  /** 「未対応のみ」既定 ON（new/in_progress/waiting） */
  const [openOnly, setOpenOnly] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [apps, asg] = await Promise.all([fetchApplications(filters), fetchAssignees()]);
      setRows(apps);
      setAssignees(asg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setRows([]);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 「未対応のみ」はクライアント側で追加フィルタ（状態フィルタ指定時は無視） */
  const visible = useMemo(() => {
    if (!rows) return null;
    if (!openOnly || filters.status) return rows;
    return rows.filter((r) => OPEN_STATUSES.includes(r.status));
  }, [rows, openOnly, filters.status]);

  return (
    <PortalLayout portal="admin">
      <Breadcrumb
        items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "申請・タスク" }]}
      />
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">申請・タスク</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--qolc-muted)" }}>
          加盟店申請・住み替え相談を一元管理します。担当者・状態・次アクションで「誰が今なにをしているか」を把握できます。
        </p>
      </div>

      <ApplicationFilters
        filters={filters}
        assignees={assignees}
        openOnly={openOnly}
        onChange={setFilters}
        onOpenOnlyChange={setOpenOnly}
      />

      {error && (
        <p className="text-sm my-3" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      {!visible ? (
        <LoadingSpinner />
      ) : visible.length === 0 ? (
        <EmptyState
          title="該当する申請がありません"
          description="フィルタ条件を変更するか、公開フォームからの受付をお待ちください。"
        />
      ) : (
        <DataTable<ApplicationRow>
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedId(r.id)}
          columns={[
            {
              key: "source",
              header: "種別",
              render: (r) => SOURCE_LABELS[r.source],
            },
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
              render: (r) => (
                <span className={r.assigneeName ? "font-medium" : ""} style={r.assigneeName ? undefined : { color: "var(--qolc-muted)" }}>
                  {r.assigneeName ?? "未割当"}
                </span>
              ),
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
          data={visible}
        />
      )}

      <DetailDrawer
        applicationId={selectedId}
        assignees={assignees}
        onClose={() => setSelectedId(null)}
        onSaved={() => void load()}
      />
    </PortalLayout>
  );
}
