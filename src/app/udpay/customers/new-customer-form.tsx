"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 新規顧客の登録フォーム（登録後にカード登録リンクが発行される） */
export function NewCustomerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/udpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createCustomer",
          name: String(form.get("name") ?? ""),
          contactName: String(form.get("contactName") ?? ""),
          email: String(form.get("email") ?? ""),
          cc: String(form.get("cc") ?? "")
            .split(/[,、\s]+/)
            .map((m) => m.trim())
            .filter(Boolean),
          anniversaryDay: Number(form.get("anniversaryDay") ?? 1),
          note: String(form.get("note") ?? "") || undefined,
          postalCode: String(form.get("postalCode") ?? "") || undefined,
          address1: String(form.get("address1") ?? "") || undefined,
          address2: String(form.get("address2") ?? "") || undefined,
        }),
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error ?? "登録に失敗しました");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="up-btn" onClick={() => setOpen(true)}>
        ＋ 顧客を追加
      </button>
    );
  }

  return (
    <form className="up-card" style={{ maxWidth: 480 }} onSubmit={submit}>
      <h2>新規顧客の追加</h2>
      {error && <p className="up-error">{error}</p>}
      <div className="up-field">
        <label htmlFor="up-name">医院名・会社名</label>
        <input id="up-name" name="name" required placeholder="例: こだま歯科クリニック" />
      </div>
      <div className="up-field">
        <label htmlFor="up-contact">担当者名</label>
        <input id="up-contact" name="contactName" required placeholder="例: 児玉" />
      </div>
      <div className="up-field">
        <label htmlFor="up-email">請求メールの宛先（To）</label>
        <input id="up-email" name="email" type="email" required placeholder="例: info@example.com" />
      </div>
      <div className="up-field">
        <label htmlFor="up-cc">CC（複数はカンマ区切り）</label>
        <input id="up-cc" name="cc" placeholder="例: keiri@example.com, jimu@example.com" />
      </div>
      <div className="up-field">
        <label htmlFor="up-day">毎月の決済日（1〜28）</label>
        <input
          id="up-day"
          name="anniversaryDay"
          type="number"
          min={1}
          max={28}
          defaultValue={15}
          required
        />
      </div>
      <div className="up-field">
        <label htmlFor="up-postal">住所（領収証の宛先に記載・任意）</label>
        <input id="up-postal" name="postalCode" placeholder="郵便番号 例: 150-0001" style={{ marginBottom: 6 }} />
        <input name="address1" aria-label="住所1行目" placeholder="例: 東京都渋谷区神宮前1-2-3" style={{ marginBottom: 6 }} />
        <input name="address2" aria-label="住所2行目" placeholder="建物名など（任意）" />
      </div>
      <div className="up-field">
        <label htmlFor="up-note">備考（社内向け・請求書には載りません）</label>
        <input id="up-note" name="note" placeholder="例: 請求書は院長と経理の両方へ" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="up-btn" disabled={busy}>
          {busy ? "登録中…" : "登録する"}
        </button>
        <button
          type="button"
          className="up-btn secondary"
          onClick={() => setOpen(false)}
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
