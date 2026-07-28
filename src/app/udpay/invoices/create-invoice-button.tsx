"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 顧客の当月請求書（下書き）を作成し、編集画面へ遷移するボタン */
export function CreateInvoiceButton({
  customerId,
  month,
}: {
  customerId: string;
  month: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/udpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createInvoice", customerId, month }),
      });
      const data: { ok: boolean; invoice?: { id: string }; error?: string } =
        await res.json();
      if (!data.ok || !data.invoice) {
        alert(data.error ?? "作成に失敗しました");
        return;
      }
      router.push(`/udpay/invoices/${data.invoice.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="up-btn secondary small"
      onClick={create}
      disabled={busy}
    >
      {busy ? "作成中…" : "新規作成"}
    </button>
  );
}
