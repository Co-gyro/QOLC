/**
 * 申請工程セクション（source=qolc_merchant のみ）
 *
 * - 未起票: 「申請工程を開始」ボタン（13工程チェックリストの起票）
 * - 起票済み: 進捗（done数/全数）と /admin/tasks/{runId} へのリンクを表示
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { startApplicationWorkflow } from "@/lib/applications/client";
import { RUN_STATUS_LABELS } from "@/lib/workflow/types";
import type { ApplicationDetail } from "@/lib/applications/types";

export interface WorkflowSectionProps {
  detail: ApplicationDetail;
  /** 起票成功後に詳細を再読込させる */
  onStarted: () => void;
}

export function WorkflowSection({ detail, onStarted }: WorkflowSectionProps) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = detail.workflowRun ?? null;

  /** 工程を起票する */
  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      await startApplicationWorkflow(detail.id);
      onStarted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "起票に失敗しました");
    } finally {
      setStarting(false);
    }
  }

  if (run) {
    const pct = run.totalCount > 0 ? Math.round((run.doneCount / run.totalCount) * 100) : 0;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: "#E6F4EA", color: "#1B5E20" }}
          >
            起票済み
          </span>
          <span className="text-sm font-medium" style={{ color: "var(--qolc-text)" }}>
            {run.title}
          </span>
          <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
            {RUN_STATUS_LABELS[run.status]}
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--qolc-border)" }}
          aria-hidden="true"
        >
          <div
            className="h-2 rounded-full"
            style={{ width: `${pct}%`, backgroundColor: "var(--qolc-primary)" }}
          />
        </div>
        <p className="text-sm" style={{ color: "var(--qolc-text)" }}>
          進捗：{run.doneCount} / {run.totalCount} 工程が完了
        </p>
        {/* チェックリスト系は業務アクション（緑）と区別するためアウトライン表示 */}
        <a
          href={`/admin/tasks/${run.id}`}
          className="inline-flex items-center justify-center rounded font-medium text-sm px-4 border hover:bg-gray-50"
          style={{
            borderColor: "var(--qolc-primary)",
            color: "var(--qolc-primary)",
            minHeight: 44,
            width: "fit-content",
          }}
        >
          チェックリストを開いて記録する
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        まだ申請工程は起票されていません。「申請工程を開始」を押すと、受付確認から申請書提出・審査・
        各社登録・アカウント発行までの13工程のチェックリストが作成され、進捗をチームで共有できます。
      </p>
      {error && (
        <p className="text-sm" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
      {/* チェックリスト系は業務アクション（緑）と区別するためアウトライン表示 */}
      <Button
        type="button"
        variant="outline"
        onClick={handleStart}
        disabled={starting}
        style={{
          borderColor: "var(--qolc-primary)",
          color: "var(--qolc-primary)",
          minHeight: 44,
          width: "fit-content",
        }}
      >
        {starting ? "起票中…" : "チェックリストを作成（13工程）"}
      </Button>
    </div>
  );
}
