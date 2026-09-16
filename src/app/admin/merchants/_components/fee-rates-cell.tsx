/**
 * 加盟店一覧の「料率」セル（精算料率 / カード会社手数料率 JCB・セゾン）
 *
 * Selfish へ送る料率が入力済みかを一覧で確認するための表示。編集は申請詳細の
 * UD追記情報で行う（ここでは編集しない）。未入力は "—"、旧・共通欄の暫定値は明示する。
 */
"use client";

import type { MerchantFeeRates } from "@/lib/portal/merchant-fee-rates";

/** ラベルつき1行（未入力は "—" を薄色表示） */
function Line({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div className="flex gap-1 text-xs whitespace-nowrap">
      <span style={{ color: "var(--qolc-muted)" }}>{label}:</span>
      {value ? (
        <span className="font-mono" style={{ color: "var(--qolc-text)" }}>
          {value}%{note ? <span style={{ color: "#92400E" }}>（{note}）</span> : null}
        </span>
      ) : (
        <span style={{ color: "var(--qolc-muted)" }}>—</span>
      )}
    </div>
  );
}

export function FeeRatesCell({ rates }: { rates: MerchantFeeRates | null }) {
  if (!rates) return <span style={{ color: "var(--qolc-muted)" }}>—</span>;
  const jcb = rates.jcb ?? rates.legacy;
  const saison = rates.saison ?? rates.legacy;
  return (
    <div className="flex flex-col gap-0.5">
      <Line label="精算" value={rates.settlement} />
      <Line label="JCB" value={jcb} note={!rates.jcb && rates.legacy ? "旧共通" : undefined} />
      <Line label="セゾン" value={saison} note={!rates.saison && rates.legacy ? "旧共通" : undefined} />
    </div>
  );
}
