"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerFields, customerPayload, type CustomerFieldValues } from "../customer-fields";

/** 顧客情報の編集フォーム（保存後は顧客管理へ戻る） */
export function EditCustomerForm({
  customerId,
  initial,
}: {
  customerId: string;
  initial: CustomerFieldValues;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/udpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateCustomer",
          customerId,
          ...customerPayload(new FormData(event.currentTarget)),
        }),
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error ?? "保存に失敗しました（入力内容をご確認ください）");
        return;
      }
      router.push("/udpay/customers");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="up-card" onSubmit={submit}>
      {error && <p className="up-error">{error}</p>}
      <CustomerFields initial={initial} />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="up-btn" disabled={busy}>
          {busy ? "保存中…" : "保存する"}
        </button>
        <button type="button" className="up-btn secondary" onClick={() => router.push("/udpay/customers")}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
