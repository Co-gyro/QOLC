"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildInvoiceMail } from "@/lib/udpay/logic";
import type { UdpayInvoiceLine } from "@/lib/udpay/types";

/** メール本文の組み立てに使う請求データ（金額・明細・決済日は固定で差し込む） */
export interface MailSource {
  customerName: string;
  contactName: string;
  month: string;
  total: number;
  chargeDate: string;
  lines: UdpayInvoiceLine[];
}

/**
 * 請求メールのプレビュー・編集（要望5）。
 * 宛先（To/CC）・件名・本文を表示し、件名と追記コメントを編集して保存できる。
 * 金額・明細・決済日の行は請求データから自動で差し込み、編集できない（青枠で表示）。
 * editable=false のときは送付済みメールの表示のみ。
 */
export function MailEditor({
  invoiceId,
  editable,
  to,
  cc,
  source,
  initialSubject,
  initialComment,
}: {
  invoiceId: string;
  editable: boolean;
  to: string;
  cc: string[];
  source: MailSource;
  initialSubject?: string;
  initialComment?: string;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [comment, setComment] = useState(initialComment ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mail = buildInvoiceMail({ ...source, subject, comment });
  const [before, after] = mail.body.split(mail.fixedBlock);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/udpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateInvoiceMail", invoiceId, subject, comment }),
      });
      const data: { ok: boolean; error?: string } = await res.json();
      setMessage(data.ok ? "保存しました" : (data.error ?? "保存に失敗しました"));
      if (data.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="up-mail">
      <div className="up-mail-subject">
        <div>To: {to}</div>
        <div>CC: {cc.length > 0 ? cc.join(", ") : "なし"}</div>
        {editable ? (
          <div className="up-field" style={{ marginTop: 8, marginBottom: 0 }}>
            <label htmlFor="up-mail-subject">件名</label>
            <input
              id="up-mail-subject"
              value={subject}
              placeholder={mail.subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        ) : (
          <div>件名: {mail.subject}</div>
        )}
      </div>
      {editable && (
        <div className="up-field">
          <label htmlFor="up-mail-comment">追記コメント（本文の冒頭あいさつの後に入ります）</label>
          <textarea
            id="up-mail-comment"
            value={comment}
            placeholder="例: 今月より料金を改定いたしました。"
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      )}
      <div className="up-mail-body">
        {before}
        <div className="up-mail-fixed" title="請求データから自動で差し込まれます（編集不可）">
          {mail.fixedBlock}
        </div>
        {after}
      </div>
      {editable && (
        <div className="up-actions" style={{ marginTop: 12 }}>
          <button type="button" className="up-btn secondary" onClick={save} disabled={busy}>
            {busy ? "保存中…" : "メール内容を保存"}
          </button>
          <span className="up-muted">
            {message ?? "青枠の金額・明細・決済日は請求内容から自動で入ります。メールは一括実行時に送付されます。"}
          </span>
        </div>
      )}
    </div>
  );
}
