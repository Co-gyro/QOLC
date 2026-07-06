"use client";

/**
 * /admin/tasks/[id] … 業務タスクのチェックリスト詳細
 *
 * 各工程をチェックで消化する。全工程が消化されるとタスクは自動で完了になる。
 */
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PortalLayout } from "@/components/layout/portal-layout";
import { FlowStepper } from "@/components/workflow/flow-stepper";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import {
  fetchWorkflowRunDetail,
  patchWorkflowStep,
  fmtDate,
  fmtDateTime,
  type WorkflowRunDetail,
} from "@/lib/portal/workflow-client";
import { fetchAssignees } from "@/lib/applications/client";
import type { AssigneeOption } from "@/lib/applications/types";
import type { WorkflowStepStatus } from "@/lib/workflow/types";
import { RunStatusBadge, RunProgressBar } from "../run-badges";
import { RunMeta } from "./run-meta";
import { StepItem } from "./step-item";

export default function AdminTaskDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const [run, setRun] = useState<WorkflowRunDetail | null>(null);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detail, asg] = await Promise.all([fetchWorkflowRunDetail(runId), fetchAssignees()]);
      setRun(detail);
      setAssignees(asg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** ステップ更新（状態 or メモ）→ 再読込。自動完了時はお知らせを表示 */
  const updateStep = useCallback(
    async (stepId: string, patch: { status?: WorkflowStepStatus; note?: string | null }) => {
      setBusy(true);
      setNotice(null);
      setError(null);
      try {
        const res = await patchWorkflowStep(runId, stepId, patch);
        if (res.autoCompleted) {
          setNotice("すべての工程が消化されたため、このタスクは自動で完了になりました。");
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新に失敗しました");
      } finally {
        setBusy(false);
      }
    },
    [runId, load]
  );

  return (
    <PortalLayout portal="admin">
      <Breadcrumb
        items={[
          { label: "ダッシュボード", href: "/admin/dashboard" },
          { label: "業務タスク", href: "/admin/tasks" },
          { label: run?.title ?? "詳細" },
        ]}
      />

      {error && (
        <p className="text-sm my-3" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      {!run ? (
        error ? (
          <EmptyState
            title="タスクを表示できません"
            description="タスクが存在しないか、削除された可能性があります。業務タスク一覧から選び直してください。"
          />
        ) : (
          <LoadingSpinner />
        )
      ) : (
        <>
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{run.title}</h1>
              <RunStatusBadge status={run.status} />
            </div>
            <p className="mt-2 text-sm" style={{ color: "var(--qolc-muted)" }}>
              各工程のガイドに沿って作業し、終わったらチェックを付けてください。
              全工程が完了（またはスキップ）になると、タスクは自動で完了になります。
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm" style={{ color: "var(--qolc-muted)" }}>
              <span>テンプレ: {run.templateName ?? run.templateCode}</span>
              <span>起票: {fmtDate(run.createdAt)}（{run.createdByName ?? "自動起票"}）</span>
              {run.completedAt && <span>完了: {fmtDateTime(run.completedAt)}</span>}
              <span className="min-w-[160px] flex-1 max-w-[280px]">
                <RunProgressBar progress={run.progress} />
              </span>
            </div>
            {(run.applicationId || run.merchantId) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span style={{ color: "var(--qolc-muted)" }}>関連:</span>
                {run.applicationId && (
                  <Link
                    href={`/admin/applications?open=${run.applicationId}`}
                    className="underline font-medium"
                    style={{ color: "var(--qolc-primary)" }}
                  >
                    元の申請を開く（フォーム入力内容・対応履歴）
                  </Link>
                )}
                {run.merchantId && (
                  <Link
                    href={`/admin/merchants?highlight=${run.merchantId}`}
                    className="underline font-medium"
                    style={{ color: "var(--qolc-primary)" }}
                  >
                    加盟店管理で表示
                  </Link>
                )}
              </div>
            )}
          </div>

          <div
            className="mb-6 border rounded-lg p-4"
            style={{ borderColor: "var(--qolc-border)", backgroundColor: "white" }}
          >
            <h2 className="text-base font-bold mb-3" style={{ color: "var(--qolc-text)" }}>
              フロー全体図
            </h2>
            <FlowStepper
              steps={run.steps.map((s) => ({ key: s.id, label: s.title, status: s.status }))}
              finished={run.status !== "open"}
            />
          </div>

          {notice && (
            <p
              className="text-sm mb-4 rounded-md px-4 py-3 font-medium"
              style={{ backgroundColor: "var(--qolc-bg-soft)", color: "var(--qolc-primary)" }}
            >
              {notice}
            </p>
          )}

          <RunMeta run={run} assignees={assignees} onSaved={() => void load()} />

          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--qolc-text)" }}>
            工程チェックリスト
          </h2>
          {run.steps.length === 0 ? (
            <EmptyState
              title="工程がありません"
              description="このタスクには工程が登録されていません。起票し直すか、運営開発チームへ連絡してください。"
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {run.steps.map((s) => (
                <StepItem
                  key={s.id}
                  step={s}
                  busy={busy}
                  onChangeStatus={(status, note) =>
                    void updateStep(s.id, note !== undefined ? { status, note } : { status })
                  }
                  onSaveNote={(note) => void updateStep(s.id, { note })}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </PortalLayout>
  );
}
