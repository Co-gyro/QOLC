"use client";

/**
 * 「タスクを起票」ダイアログ（テンプレ選択 → 手動起票）
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import {
  fetchWorkflowTemplates,
  createWorkflowRun,
  categoryLabel,
  type WorkflowTemplateOption,
} from "@/lib/portal/workflow-client";
import type { AssigneeOption } from "@/lib/applications/types";

export interface CreateRunDialogProps {
  open: boolean;
  assignees: AssigneeOption[];
  onClose: () => void;
  /** 起票成功時（作成された run の id を渡す） */
  onCreated: (id: string) => void;
}

export function CreateRunDialog({ open, assignees, onClose, onCreated }: CreateRunDialogProps) {
  const [templates, setTemplates] = useState<WorkflowTemplateOption[] | null>(null);
  const [code, setCode] = useState<string>("");
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCode("");
    setTitle("");
    setAssigneeId("");
    setDueDate("");
    fetchWorkflowTemplates()
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : "テンプレの取得に失敗しました"));
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!code) {
      setError("テンプレートを選択してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await createWorkflowRun({
        template_code: code,
        title: title.trim() || undefined,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
      });
      onCreated(res.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "起票に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-1" style={{ color: "var(--qolc-text)" }}>
          タスクを起票
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
          テンプレートを選ぶと、工程のチェックリストが自動で作成されます。
        </p>

        {!templates ? (
          <LoadingSpinner label="テンプレートを読み込み中" />
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {templates.map((t) => (
              <label
                key={t.code}
                className="flex items-start gap-3 border rounded-md p-3 cursor-pointer min-h-[44px]"
                style={{
                  borderColor: code === t.code ? "var(--qolc-primary)" : "var(--qolc-border)",
                  backgroundColor: code === t.code ? "var(--qolc-bg-soft)" : undefined,
                }}
              >
                <input
                  type="radio"
                  name="template"
                  className="mt-1"
                  checked={code === t.code}
                  onChange={() => setCode(t.code)}
                />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold" style={{ color: "var(--qolc-text)" }}>
                    {t.name}
                    <span className="ml-2 text-xs font-normal" style={{ color: "var(--qolc-muted)" }}>
                      {categoryLabel(t.category)} ・ {t.stepCount}工程
                    </span>
                  </span>
                  {t.description && (
                    <span className="text-xs mt-0.5" style={{ color: "var(--qolc-muted)" }}>
                      {t.description}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <Label htmlFor="run-title">タイトル（空欄なら自動で付きます）</Label>
            <Input
              id="run-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 2026年7月 15日締め精算"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="run-assignee">担当者</Label>
            <select
              id="run-assignee"
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
            <Label htmlFor="run-due">期限</Label>
            <Input
              id="run-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm mb-3" style={{ color: "#DC2626" }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" className="min-h-[44px]" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button
            className="min-h-[44px]"
            style={{ backgroundColor: "var(--qolc-primary)", color: "white" }}
            onClick={() => void submit()}
            disabled={saving || !code}
          >
            {saving ? "起票中…" : "この内容で起票する"}
          </Button>
        </div>
      </div>
    </div>
  );
}
