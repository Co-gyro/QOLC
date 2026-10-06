"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateJa, formatMonthJa, formatYen } from "@/lib/udpay/logic";

/** 一括実行の対象候補（課金予約の請求1件） */
export interface ConfirmCandidate {
  invoiceId: string;
  customerName: string;
  month: string;
  amount: number;
  /** 本来の決済日 */
  plannedDate: string;
  /** 実際の課金日（予定日を過ぎていれば翌日） */
  chargeDate: string;
  /** 入金予定日 */
  payoutDate: string;
  to: string;
  cc: string[];
  /** 対象にできない理由（カード未登録など） */
  blocker: string | null;
}

/**
 * 一括実行の確認フォーム。チェックした請求だけを決済確定し、合計件数・金額を常に表示する。
 */
export function ConfirmForm({ candidates }: { candidates: ConfirmCandidate[] }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(
    new Set(candidates.filter((c) => !c.blocker).map((c) => c.invoiceId)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = candidates.filter((c) => checked.has(c.invoiceId));
  const total = selected.reduce((s, c) => s + c.amount, 0);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function execute() {
    if (!confirm(`${selected.length}件・${formatYen(total)}を決済確定し、請求メールを送信します。よろしいですか？`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/udpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirmInvoices", invoiceIds: selected.map((c) => c.invoiceId) }),
      });
      const data: { ok: boolean; confirmed?: number; skipped?: unknown[]; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error ?? "一括実行に失敗しました");
        return;
      }
      const done = `一括実行しました: 決済確定 ${data.confirmed ?? 0}件（請求メール送付済み）`;
      router.push(`/udpay/payments?month=${selected[0]?.month ?? ""}&done=${encodeURIComponent(done)}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p className="up-error">{error}</p>}
      <div className="up-table-wrap">
        <table className="up-table">
          <thead>
            <tr>
              <th>対象</th>
              <th>顧客名</th>
              <th className="num">金額（税込）</th>
              <th>課金日</th>
              <th>入金予定日</th>
              <th>メール宛先</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.invoiceId} className={c.blocker ? "disabled" : ""}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${c.customerName}を対象にする`}
                    checked={checked.has(c.invoiceId)}
                    disabled={!!c.blocker}
                    onChange={() => toggle(c.invoiceId)}
                  />
                </td>
                <td>
                  <strong>{c.customerName}</strong>
                  <div className="up-muted">{formatMonthJa(c.month)}サービス分</div>
                  {c.blocker && <span className="up-badge failed">対象外: {c.blocker}</span>}
                </td>
                <td className="num">{formatYen(c.amount)}</td>
                <td>
                  {formatDateJa(c.chargeDate)}
                  {c.chargeDate !== c.plannedDate && (
                    <div style={{ color: "var(--amber)" }}>
                      予定日（{formatDateJa(c.plannedDate)}）を過ぎているため、翌日に課金します
                    </div>
                  )}
                </td>
                <td>{formatDateJa(c.payoutDate)}</td>
                <td>
                  <div>To: {c.to}</div>
                  {c.cc.length > 0 && <div className="up-muted">CC: {c.cc.join(", ")}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="up-card" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            対象 {selected.length}件・合計 {formatYen(total)}
          </div>
          <div className="up-muted">実行すると請求メールを一括送信し、各顧客の決済日に登録カードへ課金します。</div>
        </div>
        <button type="button" className="up-btn" disabled={busy || selected.length === 0} onClick={execute}>
          {busy ? "実行中…" : "メールを一括送信して決済確定する"}
        </button>
      </div>
    </div>
  );
}
