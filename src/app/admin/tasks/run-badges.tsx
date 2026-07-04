/**
 * 業務タスク（ワークフロー）用のバッジ・進捗バー
 *
 * 日本語ラベルは RUN_STATUS_LABELS / STEP_STATUS_LABELS を使用する（規約）。
 */
import {
  RUN_STATUS_LABELS,
  STEP_STATUS_LABELS,
  type WorkflowRunStatus,
  type WorkflowStepStatus,
} from "@/lib/workflow/types";
import type { RunProgress } from "@/lib/portal/workflow-logic";

const RUN_COLORS: Record<WorkflowRunStatus, { bg: string; fg: string }> = {
  open: { bg: "#E0F2FE", fg: "#0369A1" },
  done: { bg: "#E6F4EA", fg: "#1B5E20" },
  canceled: { bg: "#F3F4F6", fg: "#4B5563" },
};

const STEP_COLORS: Record<WorkflowStepStatus, { bg: string; fg: string }> = {
  todo: { bg: "#F3F4F6", fg: "#4B5563" },
  done: { bg: "#E6F4EA", fg: "#1B5E20" },
  skipped: { bg: "#FFF7E6", fg: "#B45309" },
};

/** run 状態バッジ（進行中/完了/中止） */
export function RunStatusBadge({ status }: { status: WorkflowRunStatus }) {
  const c = RUN_COLORS[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {RUN_STATUS_LABELS[status]}
    </span>
  );
}

/** ステップ状態バッジ（未着手/完了/スキップ） */
export function StepStatusBadge({ status }: { status: WorkflowStepStatus }) {
  const c = STEP_COLORS[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {STEP_STATUS_LABELS[status]}
    </span>
  );
}

/** 進捗バー（消化済み = done + skipped）。「n/m」の数字も添える */
export function RunProgressBar({ progress }: { progress: RunProgress }) {
  const consumed = progress.done + progress.skipped;
  const pct = progress.total > 0 ? Math.round((consumed / progress.total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div
        className="h-2 rounded-full flex-1 overflow-hidden"
        style={{ backgroundColor: "var(--qolc-border)" }}
        role="progressbar"
        aria-valuenow={consumed}
        aria-valuemin={0}
        aria-valuemax={progress.total}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: "var(--qolc-primary)" }}
        />
      </div>
      <span className="text-sm tabular-nums" style={{ color: "var(--qolc-muted)" }}>
        {consumed}/{progress.total}
      </span>
    </div>
  );
}
