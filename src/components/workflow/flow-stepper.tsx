"use client";

/**
 * 業務フロー全体を横並びで図式化するステッパー。
 *
 * 各工程をノード（丸）＋接続線で描き、消化済み（done/skipped）・現在地・未着手を
 * 色分けして「全体のどこまで進んでいるか」をひと目で示す。
 * 現在地＝seq 順で最初に todo の工程（resolveCurrentStepIndex と同一規則）。
 */
import { resolveCurrentStepIndex } from "@/lib/portal/workflow-logic";
import type { WorkflowStepStatus } from "@/lib/workflow/types";

export interface FlowStepperStep {
  key: string | number;
  label: string;
  status: WorkflowStepStatus;
}

export interface FlowStepperProps {
  steps: FlowStepperStep[];
  /** 完了済みタスクなど「現在地」を出さない場合 true */
  finished?: boolean;
}

export function FlowStepper({ steps, finished = false }: FlowStepperProps) {
  if (steps.length === 0) return null;
  const currentIdx = finished ? -1 : resolveCurrentStepIndex(steps.map((s) => s.status));

  return (
    <div className="overflow-x-auto pb-2" role="list" aria-label="フロー全体図">
      <ol className="flex items-start min-w-max">
        {steps.map((s, i) => {
          const passed = s.status !== "todo";
          const isCurrent = i === currentIdx;
          const circleStyle: React.CSSProperties = passed
            ? s.status === "skipped"
              ? { backgroundColor: "#E5E7EB", color: "#6B7280" }
              : { backgroundColor: "var(--qolc-primary)", color: "white" }
            : isCurrent
              ? {
                  backgroundColor: "white",
                  color: "var(--qolc-primary)",
                  border: "3px solid var(--qolc-primary)",
                  boxShadow: "0 0 0 4px var(--qolc-bg-soft)",
                }
              : { backgroundColor: "#F3F4F6", color: "#9CA3AF", border: "1px solid #E5E7EB" };
          return (
            <li key={s.key} className="flex items-start" role="listitem">
              {i > 0 && (
                <div
                  aria-hidden
                  className="h-0.5 w-8 md:w-12 mt-4 shrink-0"
                  style={{
                    backgroundColor: passed || isCurrent ? "var(--qolc-primary)" : "#E5E7EB",
                  }}
                />
              )}
              <div className="flex flex-col items-center w-24 md:w-28">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={circleStyle}
                >
                  {s.status === "done" ? "✓" : s.status === "skipped" ? "−" : i + 1}
                </div>
                {isCurrent && (
                  <span
                    className="mt-1 text-sm px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: "var(--qolc-warm, #E8913A)", color: "white" }}
                  >
                    現在地
                  </span>
                )}
                <span
                  className="mt-1 text-sm text-center leading-snug"
                  style={{
                    color: isCurrent ? "var(--qolc-text)" : "var(--qolc-muted)",
                    fontWeight: isCurrent ? 700 : 400,
                  }}
                >
                  {s.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
