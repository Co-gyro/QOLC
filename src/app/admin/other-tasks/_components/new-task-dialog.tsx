"use client";

/**
 * その他業務タスクの起票ダイアログ
 * 突発業務（差異調査・届出・チャージバック対応など）をその場で記録する。
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UdTextField, UD_INPUT_CLASS, UD_INPUT_STYLE } from "@/components/applications/ud-text-field";
import { createOpsTask } from "@/lib/ops-tasks/client";
import type { AssigneeOption } from "@/lib/applications/types";

export interface NewTaskDialogProps {
  open: boolean;
  assignees: AssigneeOption[];
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = { title: "", category: "", assigneeId: "", dueDate: "", note: "" };

export function NewTaskDialog({ open, assignees, onClose, onCreated }: NewTaskDialogProps) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("タスク名を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createOpsTask({
        title: form.title.trim(),
        category: form.category,
        assigneeId: form.assigneeId || null,
        dueDate: form.dueDate || null,
        note: form.note,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "起票に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <form
        className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 p-6 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="text-lg font-bold" style={{ color: "var(--qolc-text)" }}>
          タスクを起票
        </h2>
        <UdTextField
          label="タスク名（必須）"
          value={form.title}
          placeholder="例：5月分 入金差異の調査（¥1,200）"
          onChange={(v) => setForm((p) => ({ ...p, title: v }))}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UdTextField
            label="分類"
            value={form.category}
            placeholder="例：入金管理 / 届出 / サポート"
            onChange={(v) => setForm((p) => ({ ...p, category: v }))}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: "var(--qolc-muted)" }}>担当</span>
            <select
              className={UD_INPUT_CLASS}
              style={UD_INPUT_STYLE}
              value={form.assigneeId}
              onChange={(e) => setForm((p) => ({ ...p, assigneeId: e.target.value }))}
            >
              <option value="">未割当</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: "var(--qolc-muted)" }}>期限</span>
            <input
              type="date"
              className={UD_INPUT_CLASS}
              style={UD_INPUT_STYLE}
              value={form.dueDate}
              onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
            />
          </label>
        </div>
        <UdTextField
          label="メモ"
          value={form.note}
          placeholder="経緯・確認先など"
          onChange={(v) => setForm((p) => ({ ...p, note: v }))}
        />
        {error && (
          <p className="text-sm" style={{ color: "#DC2626" }}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} style={{ minHeight: 44 }}>
            キャンセル
          </Button>
          <Button
            type="submit"
            disabled={saving}
            style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
          >
            {saving ? "起票中…" : "起票する"}
          </Button>
        </div>
      </form>
    </div>
  );
}
