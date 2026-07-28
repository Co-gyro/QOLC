"use client";

import { useState } from "react";

/**
 * 顧客向けカード登録フォーム（デモ）。
 * カード番号は簡易チェックのみ行い、サーバーには番号そのものを保存しない
 * （マスク済み表示のみ保持。実サービスでは決済代行のトークン化を利用）。
 */
export function CardForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ masked: string; brand: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cardNumber = String(form.get("cardNumber") ?? "");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/udpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "registerCard", token, cardNumber }),
      });
      const data: {
        ok: boolean;
        error?: string;
        customer?: { card: { maskedNumber?: string; brand?: string } };
      } = await res.json();
      if (!data.ok) {
        setError(data.error ?? "登録に失敗しました");
        return;
      }
      setDone({
        masked: data.customer?.card.maskedNumber ?? "",
        brand: data.customer?.card.brand ?? "",
      });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="up-card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <h2>カードの登録が完了しました</h2>
        <p>
          {done.brand} {done.masked}
        </p>
        <p style={{ color: "var(--muted)" }}>
          今後の毎月のお支払いは、このカードへ自動で請求されます。
          お振込の必要はありません。この画面は閉じていただいて構いません。
        </p>
      </div>
    );
  }

  return (
    <form className="up-card" onSubmit={submit}>
      {error && <p className="up-error">{error}</p>}
      <div className="up-field">
        <label htmlFor="up-card-number">カード番号</label>
        <input
          id="up-card-number"
          name="cardNumber"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          required
        />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div className="up-field" style={{ flex: 1 }}>
          <label htmlFor="up-card-exp">有効期限（MM/YY）</label>
          <input id="up-card-exp" name="expiry" placeholder="12/28" required />
        </div>
        <div className="up-field" style={{ flex: 1 }}>
          <label htmlFor="up-card-cvc">セキュリティコード</label>
          <input id="up-card-cvc" name="cvc" inputMode="numeric" placeholder="123" required />
        </div>
      </div>
      <button type="submit" className="up-btn" style={{ width: "100%" }} disabled={busy}>
        {busy ? "登録中…" : "このカードを登録する"}
      </button>
      <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 12, marginBottom: 0 }}>
        ※デモ環境のため実際の決済・与信は行われません。テスト番号（4242 4242 4242 4242
        など）をご利用ください。
      </p>
    </form>
  );
}
