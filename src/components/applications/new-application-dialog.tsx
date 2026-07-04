/**
 * 新規案件の手動起票ダイアログ
 *
 * 電話・窓口などフォーム外で受け付けた案件をその場で記録する。
 * POST /api/admin/applications（作成者と created イベントを記録）を呼び出す。
 */
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApplicationCreateSchema } from "@/lib/applications/admin-intake";
import { createApplication } from "@/lib/applications/client";
import { ALL_SOURCES, SOURCE_LABELS, type ApplicationSource } from "@/lib/applications/labels";

export interface NewApplicationDialogProps {
  open: boolean;
  onClose: () => void;
  /** 起票成功後に一覧を再取得させる */
  onCreated: () => void;
}

const INPUT_CLASS = "border rounded px-2 py-2 text-sm w-full bg-white";
const INPUT_STYLE = { borderColor: "var(--qolc-border)", minHeight: 44 };

const EMPTY = { source: "contact" as string, name: "", org: "", email: "", phone: "", message: "" };

export function NewApplicationDialog({ open, onClose, onCreated }: NewApplicationDialogProps) {
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

  /** 入力を検証して起票する */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = adminApplicationCreateSchema.safeParse({
      source: form.source,
      applicant_name: form.name,
      applicant_org: form.org || undefined,
      applicant_email: form.email || undefined,
      applicant_phone: form.phone || undefined,
      message: form.message,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    setSaving(true);
    try {
      await createApplication({
        source: parsed.data.source,
        applicant_name: parsed.data.applicant_name,
        applicant_org: parsed.data.applicant_org,
        applicant_email: parsed.data.applicant_email || undefined,
        applicant_phone: parsed.data.applicant_phone,
        message: parsed.data.message,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "起票に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof typeof EMPTY) => (v: string) => setForm((p) => ({ ...p, [key]: v }));

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <form className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 p-6 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className="text-lg font-bold" style={{ color: "var(--qolc-text)" }}>
          新規案件を起票
        </h2>
        <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
          電話や窓口で受け付けた案件をその場で記録します。起票した案件は一覧に「新規」として追加されます。
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>種別</span>
          <select className={INPUT_CLASS} style={INPUT_STYLE} value={form.source}
            onChange={(e) => set("source")(e.target.value)}>
            {ALL_SOURCES.map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s as ApplicationSource]}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: "var(--qolc-muted)" }}>お名前（必須）</span>
            <input type="text" className={INPUT_CLASS} style={INPUT_STYLE} value={form.name}
              maxLength={100} onChange={(e) => set("name")(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: "var(--qolc-muted)" }}>所属（施設名・会社名）</span>
            <input type="text" className={INPUT_CLASS} style={INPUT_STYLE} value={form.org}
              maxLength={200} onChange={(e) => set("org")(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: "var(--qolc-muted)" }}>メールアドレス</span>
            <input type="email" className={INPUT_CLASS} style={INPUT_STYLE} value={form.email}
              maxLength={254} onChange={(e) => set("email")(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: "var(--qolc-muted)" }}>電話番号</span>
            <input type="tel" className={INPUT_CLASS} style={INPUT_STYLE} value={form.phone}
              maxLength={20} onChange={(e) => set("phone")(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>ご用件・受付内容（必須）</span>
          <textarea className={INPUT_CLASS} style={{ ...INPUT_STYLE, minHeight: 88 }} rows={4}
            maxLength={2000} value={form.message}
            placeholder="例：7/4 電話受付。○○施設様より加盟店申請の進め方について相談。"
            onChange={(e) => set("message")(e.target.value)} />
        </label>
        {error && (
          <p className="text-sm" style={{ color: "#DC2626" }}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} style={{ minHeight: 44 }}>
            キャンセル
          </Button>
          <Button type="submit" disabled={saving}
            style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}>
            {saving ? "起票中…" : "起票する"}
          </Button>
        </div>
      </form>
    </div>
  );
}
