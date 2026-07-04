/**
 * 審査通過後のアクション（審査通過メール送信 / 加盟店として登録）
 *
 * - メール送信結果はタイムライン（email_sent）に記録される。基盤未設定時は
 *   skipped=true が返るため「記録のみ」であることを画面に明示する。
 * - 加盟店登録は確認ダイアログ（メモ入力つき）を経て POST /convert を実行する。
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sendApplicationEmail, convertApplication } from "@/lib/applications/client";
import type { ApplicationDetail } from "@/lib/applications/types";
import type { ReviewSummary } from "@/lib/applications/ud-input";

export interface ConvertActionsProps {
  detail: ApplicationDetail;
  summary: ReviewSummary;
  /** 変換・送信後に詳細を再読込させる */
  onDone: () => void;
}

export function ConvertActions({ detail, summary, onDone }: ConvertActionsProps) {
  const [mailMsg, setMailMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 審査通過メールを送信する */
  async function handleSendMail() {
    setSending(true);
    setMailMsg(null);
    try {
      const r = await sendApplicationEmail(detail.id, "review_approved");
      setMailMsg(
        r.sent
          ? `審査通過メールを ${r.to} へ送信しました（履歴に記録済み）`
          : r.skipped
            ? "メール基盤未設定のため送信されませんでした（記録のみ）"
            : `送信に失敗しました：${r.error ?? "不明なエラー"}（記録済み）`
      );
      onDone();
    } catch (e) {
      setMailMsg(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  /** 加盟店として登録する（確認済み） */
  async function handleConvert() {
    setConverting(true);
    setError(null);
    try {
      await convertApplication(detail.id, { note: note.trim() || undefined });
      setConfirming(false);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setConverting(false);
    }
  }

  if (detail.merchantId) {
    return (
      <div className="flex flex-col gap-2 rounded border p-3" style={{ borderColor: "var(--qolc-border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: "#E6F4EA", color: "#1B5E20" }}>
            加盟店へ変換済み
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
          この申請は加盟店として登録済みです。番号の追記・修正は加盟店管理から行えます。
        </p>
        <a href="/admin/merchants" className="text-sm underline font-medium"
          style={{ color: "var(--qolc-primary)" }}>
          加盟店管理を開く
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border p-3" style={{ borderColor: "var(--qolc-border)" }}>
      <p className="text-sm font-bold" style={{ color: "var(--qolc-text)" }}>
        審査通過後のアクション
      </p>
      {!summary.anyApproved && (
        <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
          いずれかの審査結果を「通過」で保存すると、次のボタンが使えるようになります。
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={!summary.anyApproved || sending || !detail.applicantEmail}
          onClick={handleSendMail} style={{ minHeight: 44 }}>
          {sending ? "送信中…" : "審査通過メールを送信"}
        </Button>
        <Button type="button" disabled={!summary.anyApproved || converting}
          onClick={() => setConfirming(true)}
          style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}>
          加盟店として登録
        </Button>
      </div>
      {!detail.applicantEmail && (
        <p className="text-xs" style={{ color: "var(--qolc-muted)" }}>
          申請者のメールアドレスが未登録のため、メール送信は利用できません。
        </p>
      )}
      {mailMsg && (
        <p className="text-sm" style={{ color: "var(--qolc-text)" }}>
          {mailMsg}
        </p>
      )}
      {confirming && (
        <div className="flex flex-col gap-2 rounded border p-3" style={{ borderColor: "var(--qolc-warm, #E8913A)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--qolc-text)" }}>
            この申請を加盟店として登録します。登録後は申請の状態が「完了」になります。
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: "var(--qolc-muted)" }}>メモ（任意。履歴に残ります）</span>
            <input type="text" className="border rounded px-2 py-2 text-sm w-full bg-white"
              style={{ borderColor: "var(--qolc-border)", minHeight: 44 }} value={note} maxLength={500}
              placeholder="例：JCB通過・セゾンは結果待ちのまま先行登録"
              onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && (
            <p className="text-sm" style={{ color: "#DC2626" }}>
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" style={{ minHeight: 44 }}
              onClick={() => setConfirming(false)}>
              キャンセル
            </Button>
            <Button type="button" disabled={converting} onClick={handleConvert}
              style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}>
              {converting ? "登録中…" : "登録を実行"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
