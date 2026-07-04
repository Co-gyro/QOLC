"use client";

/** チェックリストのステップ1件（ガイド・外部リンク・完了記録・メモ・スキップ） */
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime, type WorkflowStepItem } from "@/lib/portal/workflow-client";
import type { WorkflowStepStatus } from "@/lib/workflow/types";
import { StepStatusBadge } from "../run-badges";

export interface StepItemProps {
  step: WorkflowStepItem;
  /** 通信中は操作を無効化 */
  busy: boolean;
  /** 状態変更（note はスキップ理由を渡すときのみ） */
  onChangeStatus: (status: WorkflowStepStatus, note?: string) => void;
  /** メモの保存 */
  onSaveNote: (note: string) => void;
}

/** 外部URLは新規タブ、内部パス（/で始まる）は Link で開くボタン */
function ExternalButton({ url, label }: { url: string; label: string }) {
  const cls = "inline-flex items-center min-h-[44px] px-4 rounded-md border text-sm font-medium";
  const style = { borderColor: "var(--qolc-primary)", color: "var(--qolc-primary)" };
  if (url.startsWith("/")) {
    return (
      <Link href={url} className={cls} style={style}>
        {label} →
      </Link>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
      {label} ↗
    </a>
  );
}

export function StepItem({ step, busy, onChangeStatus, onSaveNote }: StepItemProps) {
  const [note, setNote] = useState(step.note ?? "");
  const [skipMode, setSkipMode] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const done = step.status === "done";
  const skipped = step.status === "skipped";

  return (
    <li
      className="border rounded-lg p-4 flex flex-col gap-3"
      style={{
        borderColor: done || skipped ? "var(--qolc-border)" : "var(--qolc-primary)",
        backgroundColor: done ? "var(--qolc-bg-soft)" : "white",
      }}
    >
      <div className="flex items-start gap-3">
        {/* 完了チェック（44pxのタッチ領域） */}
        <button
          type="button"
          aria-label={done ? `${step.title} を未着手に戻す` : `${step.title} を完了にする`}
          disabled={busy || skipped}
          onClick={() => onChangeStatus(done ? "todo" : "done")}
          className="flex items-center justify-center shrink-0 rounded-md"
          style={{ width: 44, height: 44, opacity: skipped ? 0.4 : 1 }}
        >
          <span
            className="flex items-center justify-center rounded border-2 text-white font-bold"
            style={{
              width: 26,
              height: 26,
              borderColor: done ? "var(--qolc-primary)" : "var(--qolc-border)",
              backgroundColor: done ? "var(--qolc-primary)" : "white",
            }}
          >
            {done ? "✓" : ""}
          </span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold" style={{ color: "var(--qolc-muted)" }}>
              {step.seq}.
            </span>
            <span
              className="text-base font-semibold"
              style={{
                color: "var(--qolc-text)",
                textDecoration: skipped ? "line-through" : undefined,
              }}
            >
              {step.title}
            </span>
            <StepStatusBadge status={step.status} />
          </div>

          {/* 作業ガイド（マニュアル不要の核。常時表示） */}
          {step.guide && (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--qolc-muted)" }}>
              {step.guide}
            </p>
          )}

          {/* 完了記録: 誰が・いつ（常時表示） */}
          {(done || skipped) && step.completedAt && (
            <p className="mt-2 text-sm font-medium" style={{ color: "var(--qolc-primary)" }}>
              {step.completedByName ?? "（不明なユーザー）"} さんが {fmtDateTime(step.completedAt)} に
              {done ? "完了" : "スキップ"}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {step.externalUrl && (
              <ExternalButton url={step.externalUrl} label={step.externalLabel ?? "リンクを開く"} />
            )}
            {step.status === "todo" && !skipMode && (
              <Button
                variant="outline"
                className="min-h-[44px]"
                disabled={busy}
                onClick={() => setSkipMode(true)}
              >
                この工程をスキップ
              </Button>
            )}
            {skipped && (
              <Button
                variant="outline"
                className="min-h-[44px]"
                disabled={busy}
                onClick={() => onChangeStatus("todo")}
              >
                未着手に戻す
              </Button>
            )}
          </div>

          {/* スキップは理由必須（記録を残す） */}
          {skipMode && (
            <div className="mt-3 border rounded-md p-3" style={{ borderColor: "#E8913A" }}>
              <p className="text-sm font-medium mb-2" style={{ color: "#B45309" }}>
                スキップ理由を入力してください（記録に残ります）
              </p>
              <Textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="例: 今回の対象データなしのため実施不要"
                rows={2}
              />
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => {
                    setSkipMode(false);
                    setSkipReason("");
                  }}
                >
                  やめる
                </Button>
                <Button
                  className="min-h-[44px]"
                  style={{ backgroundColor: "#E8913A", color: "white" }}
                  disabled={busy || !skipReason.trim()}
                  onClick={() => {
                    onChangeStatus("skipped", `スキップ理由: ${skipReason.trim()}`);
                    setSkipMode(false);
                    setSkipReason("");
                  }}
                >
                  スキップする
                </Button>
              </div>
            </div>
          )}

          {/* メモ（作業の気づき・引き継ぎ事項） */}
          <div className="mt-3">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="メモ（気づき・引き継ぎ事項など）"
              rows={1}
              className="text-sm"
            />
            {note !== (step.note ?? "") && (
              <Button
                variant="outline"
                className="mt-2 min-h-[44px]"
                disabled={busy}
                onClick={() => onSaveNote(note)}
              >
                メモを保存
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
