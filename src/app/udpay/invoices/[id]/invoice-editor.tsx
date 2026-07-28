"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { computeTotals, formatYen } from "@/lib/udpay/logic";

/** 編集中の明細行（id はクライアント管理用の連番） */
interface EditableLine {
  key: number;
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * 請求書（下書き）の明細エディタ。
 * 前月コピーされた行をベースに、金額修正・行の追加削除を行い、保存または確定する。
 */
export function InvoiceEditor({
  invoiceId,
  initialLines,
}: {
  invoiceId: string;
  initialLines: { description: string; quantity: number; unitPrice: number }[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<EditableLine[]>(
    initialLines.map((l, i) => ({ key: i, ...l })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totals = computeTotals(
    lines.map((l) => ({ id: "", taxRate: 10, ...l })),
  );

  function update(key: number, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine(description = "", unitPrice = 0) {
    setLines((prev) => [
      ...prev,
      { key: Date.now(), description, quantity: 1, unitPrice },
    ]);
  }

  /** 保存（confirm=true なら保存後に確定→課金スケジュールまで行う） */
  async function save(confirm: boolean) {
    setBusy(true);
    setError(null);
    try {
      const payload = lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: 10,
      }));
      const res = await fetch("/api/udpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateInvoiceLines",
          invoiceId,
          lines: payload,
        }),
      });
      const saved: { ok: boolean; error?: string } = await res.json();
      if (!saved.ok) {
        setError(saved.error ?? "保存に失敗しました");
        return;
      }
      if (confirm) {
        const res2 = await fetch("/api/udpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirmInvoice", invoiceId }),
        });
        const confirmed: { ok: boolean; error?: string } = await res2.json();
        if (!confirmed.ok) {
          setError(confirmed.error ?? "確定に失敗しました");
          return;
        }
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="up-card">
      {error && <p className="up-error">{error}</p>}
      <div className="up-table-wrap" style={{ border: "none" }}>
        <table className="up-table">
          <thead>
            <tr>
              <th style={{ minWidth: 280 }}>摘要</th>
              <th style={{ width: 90 }}>数量</th>
              <th style={{ width: 160 }}>単価（税抜）</th>
              <th className="num" style={{ width: 140 }}>金額</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key}>
                <td>
                  <input
                    aria-label="摘要"
                    value={l.description}
                    onChange={(e) => update(l.key, { description: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    aria-label="数量"
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => update(l.key, { quantity: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    aria-label="単価"
                    type="number"
                    min={0}
                    value={l.unitPrice}
                    onChange={(e) => update(l.key, { unitPrice: Number(e.target.value) })}
                  />
                </td>
                <td className="num">{formatYen(l.unitPrice * l.quantity)}</td>
                <td>
                  <button
                    type="button"
                    className="up-btn secondary small"
                    aria-label="行を削除"
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" className="up-btn secondary small" onClick={() => addLine()}>
          ＋ 行を追加
        </button>
        <button
          type="button"
          className="up-btn secondary small"
          onClick={() => addLine("交通費（実費）", 0)}
        >
          ＋ 交通費を追加
        </button>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 24,
          marginTop: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            小計 {formatYen(totals.subtotal)} ／ 消費税 {formatYen(totals.tax)}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            合計 {formatYen(totals.total)}（税込）
          </div>
        </div>
        <button
          type="button"
          className="up-btn secondary"
          disabled={busy}
          onClick={() => save(false)}
        >
          下書き保存
        </button>
        <button
          type="button"
          className="up-btn"
          disabled={busy}
          onClick={() => save(true)}
        >
          {busy ? "処理中…" : "確定してメール送付・課金予約"}
        </button>
      </div>
    </div>
  );
}
