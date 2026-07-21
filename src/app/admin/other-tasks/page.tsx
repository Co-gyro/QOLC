"use client";

/**
 * /admin/other-tasks … その他業務（唯一の純タスク管理画面）
 *
 * 画面機能がまだない業務（入金確認・届出・チャージバック対応など）の記録場所。
 * 未着手 → 対応中 → 完了（＋保留）で管理。定例タスクは cron が月次で自動起票する。
 * 将来ここの定型業務に画面機能ができたら業務メニューへ昇格し、ここからは消す。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchAssignees } from "@/lib/applications/client";
import { fetchOpsTasks, updateOpsTaskStatus } from "@/lib/ops-tasks/client";
import {
  compareOpsTasks,
  OPEN_OPS_STATUSES,
  type OpsTask,
  type OpsTaskStatus,
} from "@/lib/ops-tasks/logic";
import { toJstDateString } from "@/lib/portal/workflow-logic";
import { getJstDateParts } from "@/lib/workflow/utils";
import type { AssigneeOption } from "@/lib/applications/types";
import { OpsTaskTable } from "./_components/ops-task-table";
import { NewTaskDialog } from "./_components/new-task-dialog";

export default function OtherTasksPage() {
  const [tasks, setTasks] = useState<OpsTask[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [result, asg] = await Promise.all([
      fetchOpsTasks(),
      fetchAssignees().catch(() => []),
    ]);
    setTasks(result.tasks);
    setUnavailable(result.unavailable);
    setAssignees(asg);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todayStr = useMemo(() => toJstDateString(getJstDateParts()), []);

  const visible = useMemo(() => {
    if (!tasks) return null;
    const filtered = showDone
      ? tasks
      : tasks.filter((t) => OPEN_OPS_STATUSES.includes(t.status));
    return [...filtered].sort(compareOpsTasks);
  }, [tasks, showDone]);

  const assigneeNameOf = useCallback(
    (id: string | null) => assignees.find((a) => a.id === id)?.name ?? "未割当",
    [assignees]
  );

  const handleStatusChange = useCallback(
    async (id: string, status: OpsTaskStatus) => {
      setError(null);
      try {
        await updateOpsTaskStatus(id, status);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新に失敗しました");
      }
    },
    [load]
  );

  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "今日のUD", href: "/admin/today" }, { label: "その他業務" }]} />
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">その他業務</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--qolc-muted)" }}>
            画面機能がまだない業務（入金確認・届出・チャージバック対応など）の記録場所です。
            定例タスクは自動起票され、突発の作業は右上から起票できます。
          </p>
        </div>
        <button
          className="qolc-btn px-4 rounded text-white font-medium"
          style={{ backgroundColor: "var(--qolc-primary)", minHeight: 44 }}
          onClick={() => setCreating(true)}
        >
          + タスクを起票
        </button>
      </div>

      <label className="inline-flex items-center gap-2 text-sm mb-3 cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4"
          checked={showDone}
          onChange={(e) => setShowDone(e.target.checked)}
        />
        完了も表示する
      </label>

      {error && (
        <p className="text-sm my-3" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      {unavailable && (
        <p
          className="text-sm mb-3 border rounded-md px-4 py-3"
          style={{ borderColor: "#E8913A", backgroundColor: "#FFFBF5", color: "#B45309" }}
        >
          タスクテーブル（migration 033）が未適用のため表示できません。
          supabase/migrations/033_create_ops_tasks.sql を SQL Editor で適用してください。
        </p>
      )}

      {!visible ? (
        <LoadingSpinner />
      ) : visible.length === 0 ? (
        <EmptyState
          title="タスクはありません"
          description="定例タスクの自動起票を待つか、「＋ タスクを起票」から記録してください。"
        />
      ) : (
        <OpsTaskTable
          tasks={visible}
          assigneeNameOf={assigneeNameOf}
          onStatusChange={(id, s) => void handleStatusChange(id, s)}
          todayStr={todayStr}
        />
      )}

      <NewTaskDialog
        open={creating}
        assignees={assignees}
        onClose={() => setCreating(false)}
        onCreated={() => void load()}
      />
    </PortalLayout>
  );
}
