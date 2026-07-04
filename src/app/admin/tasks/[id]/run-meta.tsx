"use client";

/**
 * run のメタ情報編集（担当者/期限/メモ）と 中止/再開 操作
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { patchWorkflowRun, type WorkflowRunDetail } from "@/lib/portal/workflow-client";
import type { AssigneeOption } from "@/lib/applications/types";

export interface RunMetaProps {
  run: WorkflowRunDetail;
  assignees: AssigneeOption[];
  onSaved: () => void;
}

export function RunMeta({ run, assignees, onSaved }: RunMetaProps) {
  const [assigneeId, setAssigneeId] = useState(run.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(run.dueDate ?? "");
  const [note, setNote] = useState(run.note ?? "");
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed =
    assigneeId !== (run.assigneeId ?? "") ||
    dueDate !== (run.dueDate ?? "") ||
    note !== (run.note ?? "");

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await patchWorkflowRun(run.id, {
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        note: note || null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const cancelRun = async () => {
    setSaving(true);
    setError(null);
    try {
      // 中止理由はメモに追記して記録を残す（破壊的操作＝理由必須）
      const merged = [note.trim(), `【中止理由】${cancelReason.trim()}`]
        .filter(Boolean)
        .join("\n");
      await patchWorkflowRun(run.id, { status: "canceled", note: merged });
      setCancelMode(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "中止に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    setSaving(true);
    setError(null);
    try {
      await patchWorkflowRun(run.id, { status: "open" });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "再開に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 mb-6" style={{ borderColor: "var(--qolc-border)" }}>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="meta-assignee">担当者</Label>
          <select
            id="meta-assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="mt-1 w-full h-11 border rounded-md px-3 text-sm bg-white"
            style={{ borderColor: "var(--qolc-border)" }}
          >
            <option value="">未割当</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="meta-due">期限</Label>
          <Input
            id="meta-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="meta-note">メモ</Label>
          <Textarea
            id="meta-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={1}
            className="mt-1 text-sm"
            placeholder="このタスク全体の補足"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm mt-3" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          {run.status === "open" && !cancelMode && (
            <Button
              variant="outline"
              className="min-h-[44px]"
              style={{ color: "#DC2626", borderColor: "#DC2626" }}
              disabled={saving}
              onClick={() => setCancelMode(true)}
            >
              このタスクを中止する
            </Button>
          )}
          {run.status !== "open" && (
            <Button variant="outline" className="min-h-[44px]" disabled={saving} onClick={() => void reopen()}>
              進行中に戻す
            </Button>
          )}
        </div>
        <Button
          className="min-h-[44px]"
          style={{ backgroundColor: "var(--qolc-primary)", color: "white" }}
          disabled={saving || !changed}
          onClick={() => void save()}
        >
          {saving ? "保存中…" : "変更を保存"}
        </Button>
      </div>

      {cancelMode && (
        <div className="mt-3 border rounded-md p-3" style={{ borderColor: "#DC2626" }}>
          <p className="text-sm font-medium mb-2" style={{ color: "#DC2626" }}>
            中止理由を入力してください（メモに記録されます）。中止すると進行中一覧から外れます。
          </p>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            placeholder="例: 重複起票のため"
          />
          <div className="mt-2 flex gap-2">
            <Button variant="outline" className="min-h-[44px]" onClick={() => setCancelMode(false)}>
              やめる
            </Button>
            <Button
              className="min-h-[44px]"
              style={{ backgroundColor: "#DC2626", color: "white" }}
              disabled={saving || !cancelReason.trim()}
              onClick={() => void cancelRun()}
            >
              中止を確定する
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
