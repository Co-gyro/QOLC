"use client";

import { useState } from "react";
import { udpayAdminFetch } from "./api";

/**
 * カード登録リンクの「コピー」と「メールで送る」。
 * メールは顧客の宛先（To/CC）へ送られ、送付履歴（udpay_mail_logs）に残る。
 */
export function RegistrationLinkActions({ customerId, token }: { customerId: string; token: string }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = `${window.location.origin}/pay/udpay/${token}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setNote("コピーしました");
  }

  async function send() {
    if (!confirm("カード登録のご案内メールを、この顧客の宛先（To/CC）へ送ります。よろしいですか？")) return;
    setBusy(true);
    try {
      const r = await udpayAdminFetch<{ status: string }>(`/api/admin/udpay/customers/${customerId}/registration-mail`, {
        method: "POST",
      });
      setNote(r.status === "sent" ? "メールを送りました" : "メール未設定の環境のため送信していません（履歴のみ記録）");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  const btn = "min-h-[44px] rounded border border-[#E0DDD8] bg-white px-3 font-bold hover:bg-[#F0F9F4] disabled:opacity-50";
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={copy}>
          コピー
        </button>
        <button type="button" className={btn} onClick={send} disabled={busy}>
          {busy ? "送信中…" : "メールで送る"}
        </button>
      </div>
      {note && <div style={{ color: "var(--qolc-muted)" }}>{note}</div>}
    </div>
  );
}
