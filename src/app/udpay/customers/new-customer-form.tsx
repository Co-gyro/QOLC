"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerFields, customerPayload } from "./customer-fields";
import { useUdpayPaths } from "../_components/use-udpay-paths";

/** 新規顧客の登録フォーム（登録後にカード登録リンクが発行される） */
export function NewCustomerForm() {
  const { api } = useUdpayPaths();
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
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createCustomer", ...customerPayload(form) }),
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
      <CustomerFields />
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
