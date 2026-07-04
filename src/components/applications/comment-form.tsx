/**
 * 対応メモ入力フォーム
 *
 * 電話・メールでのやり取りを application_events（kind='comment'）に記録する。
 * 記録後は変更履歴タイムラインに「誰が・いつ・何を」が表示される。
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { postApplicationComment } from "@/lib/applications/client";

export interface CommentFormProps {
  applicationId: string;
  /** 記録成功後に詳細を再読込させる */
  onSaved: () => void;
}

export function CommentForm({ applicationId, onSaved }: CommentFormProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** メモを送信して入力欄をクリアする */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await postApplicationComment(applicationId, text.trim());
      setText("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "記録に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        電話・メールでのやり取りをここに記録すると、下の変更履歴に残ります（誰が・いつ対応したかを共有できます）。
      </p>
      <textarea
        className="border rounded px-3 py-2 text-sm w-full bg-white"
        style={{ borderColor: "var(--qolc-border)", minHeight: 72 }}
        rows={3}
        maxLength={2000}
        value={text}
        placeholder="例：7/4 10:30 ご担当者へ架電。申請書類の不足を案内、来週再送いただく予定。"
        onChange={(e) => setText(e.target.value)}
      />
      {error && (
        <p className="text-sm" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving || !text.trim()}
          style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
        >
          {saving ? "記録中…" : "対応メモを記録"}
        </Button>
      </div>
    </form>
  );
}
