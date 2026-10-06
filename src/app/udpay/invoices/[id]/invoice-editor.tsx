"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { computeTotals, formatYen } from "@/lib/udpay/logic";
import { LineRow, type EditableLine } from "./line-row";

/**
 * 請求書（下書き）の明細エディタ（要望4）。
 * コピーされた行をベースに金額修正・行の追加削除（マイナス＝値引き可）を行い、
 * 「下書き保存」または「課金予約」する。課金予約ではメールは送らない。
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

  const reserveBlocked =
    lines.length === 0
      ? "明細行がないため課金予約できません"
      : totals.total <= 0
        ? "請求合計が0円以下のため課金予約できません（値引きは翌月の請求での相殺もご検討ください）"
        : null;

  function update(key: number, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine(description = "", unitPrice = 0) {
    setLines((prev) => [
      ...prev,
      { key: Date.now(), description, quantity: 1, unitPrice },
    ]);
  }

  /** 保存（reserve=true なら保存後に課金予約する） */
  async function save(reserve: boolean) {
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
      if (reserve) {
        const res2 = await fetch("/api/udpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reserveInvoices", invoiceIds: [invoiceId] }),
        });
        const reserved: { ok: boolean; error?: string } = await res2.json();
        if (!reserved.ok) {
          setError(reserved.error ?? "課金予約に失敗しました");
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
              <LineRow
                key={l.key}
                line={l}
                onChange={(patch) => update(l.key, patch)}
                onRemove={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
              />
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
          disabled={busy || reserveBlocked !== null}
          title={reserveBlocked ?? undefined}
          onClick={() => save(true)}
        >
          {busy ? "処理中…" : "課金予約"}
        </button>
      </div>
      <p className="up-muted" style={{ textAlign: "right", marginBottom: 0 }}>
        {reserveBlocked ??
          "「課金予約」を押してもメールは送られません。メール送付と決済確定は承認者が一括実行で行います。"}
      </p>
    </div>
  );
}
