"use client";

/**
 * /admin/tasks … 業務チェックリスト（ワークフロー）一覧。精算・日次などの定例業務と、加盟店申請の工程消化を扱う
 *
 * テンプレから起票されたチェックリスト作業を「進行中/完了」タブで一覧する。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchWorkflowRuns,
  categoryLabel,
  fmtDate,
  type WorkflowRunListItem,
} from "@/lib/portal/workflow-client";
import { isOverdue, toJstDateString } from "@/lib/portal/workflow-logic";
import { getJstDateParts } from "@/lib/workflow/utils";
import { fetchAssignees } from "@/lib/applications/client";
import type { AssigneeOption } from "@/lib/applications/types";
import { RunStatusBadge, RunProgressBar } from "./run-badges";
import { CreateRunDialog } from "./create-run-dialog";

type TabKey = "open" | "closed";

export default function AdminTasksPage() {
  const router = useRouter();
  const [rows, setRows] = useState<WorkflowRunListItem[] | null>(null);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [tab, setTab] = useState<TabKey>("open");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [runs, asg] = await Promise.all([fetchWorkflowRuns(), fetchAssignees()]);
      setRows(runs);
      setAssignees(asg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todayStr = useMemo(() => toJstDateString(getJstDateParts()), []);
  const visible = useMemo(() => {
    if (!rows) return null;
    return tab === "open"
      ? rows.filter((r) => r.status === "open")
      : rows.filter((r) => r.status !== "open");
  }, [rows, tab]);

  const openCreate = (
    <Button
      className="min-h-[44px]"
      style={{ backgroundColor: "var(--qolc-primary)", color: "white" }}
      onClick={() => setDialogOpen(true)}
    >
      ＋ タスクを起票
    </Button>
  );

  return (
    <PortalLayout portal="admin">
      <Breadcrumb
        items={[{ label: "今日のUD", href: "/admin/today" }, { label: "月次精算・チェック" }]}
      />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">月次精算・チェック</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--qolc-muted)" }}>
            月次精算や加盟店申請などの定型業務をチェックリストで進めます。
            タスクを開くと、各工程のやり方（ガイド）と完了記録（誰が・いつ）が確認できます。
          </p>
        </div>
        {openCreate}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-3">
        <TabsList>
          <TabsTrigger value="open">進行中</TabsTrigger>
          <TabsTrigger value="closed">完了・中止</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <p className="text-sm my-3" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      {!visible ? (
        <LoadingSpinner />
      ) : visible.length === 0 ? (
        <EmptyState
          title={tab === "open" ? "進行中のタスクはありません" : "完了したタスクはまだありません"}
          description={
            tab === "open"
              ? "「タスクを起票」からテンプレートを選ぶと、工程のチェックリストが作成されます。月次精算などは毎日の自動起票でも追加されます。"
              : "進行中のタスクの全工程を完了すると、ここに表示されます。"
          }
          action={tab === "open" ? openCreate : undefined}
        />
      ) : (
        <DataTable<WorkflowRunListItem>
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/admin/tasks/${r.id}`)}
          columns={[
            {
              key: "title",
              header: "タスク",
              render: (r) => (
                <div className="flex flex-col">
                  <span className="font-medium">{r.title}</span>
                  {r.templateName && (
                    <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
                      {r.templateName}
                    </span>
                  )}
                </div>
              ),
            },
            { key: "category", header: "カテゴリ", render: (r) => categoryLabel(r.category) },
            { key: "status", header: "状態", render: (r) => <RunStatusBadge status={r.status} /> },
            { key: "progress", header: "進捗", render: (r) => <RunProgressBar progress={r.progress} /> },
            {
              key: "assignee",
              header: "担当者",
              render: (r) =>
                r.assigneeName ? (
                  <span className="font-medium">{r.assigneeName}</span>
                ) : (
                  <span style={{ color: "var(--qolc-muted)" }}>未割当</span>
                ),
            },
            {
              key: "due",
              header: "期限",
              render: (r) =>
                r.status === "open" && isOverdue(r.dueDate, todayStr) ? (
                  <span className="font-bold" style={{ color: "#DC2626" }}>
                    {fmtDate(r.dueDate)}（超過）
                  </span>
                ) : (
                  fmtDate(r.dueDate)
                ),
            },
            { key: "created", header: "起票日", render: (r) => fmtDate(r.createdAt) },
          ]}
          data={visible}
        />
      )}

      <CreateRunDialog
        open={dialogOpen}
        assignees={assignees}
        onClose={() => setDialogOpen(false)}
        onCreated={(id) => {
          setDialogOpen(false);
          router.push(`/admin/tasks/${id}`);
        }}
      />
    </PortalLayout>
  );
}
