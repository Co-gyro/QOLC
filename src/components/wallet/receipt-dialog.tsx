"use client";

/**
 * レシートの画像と読み取り結果のダイアログ（施設ポータル「お買い物」）。
 */
import type { DeclarationDto } from "@/lib/wallet/declarations";
import { DeclarationStatusBadge, jstDateTime, yen } from "./wallet-status";

/** レシートのダイアログ */
export function ReceiptDialog({ declaration, onClose }: { declaration: DeclarationDto; onClose: () => void }) {
  const d = declaration;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="レシート">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{d.resident_name} さん</h2>
            <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
              {jstDateTime(d.paid_at ?? d.selected_at)}・{d.merchant_name ?? "店名なし"}
            </p>
          </div>
          <button onClick={onClose} className="rounded border px-4 text-sm" style={{ minHeight: 44, borderColor: "var(--qolc-border)" }}>
            閉じる
          </button>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            {d.receipt_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- 署名付き URL（1時間有効）をそのまま表示する
              <img src={d.receipt_image_url} alt={`${d.resident_name}さんのレシート`} className="w-full rounded border" style={{ borderColor: "var(--qolc-border)" }} />
            ) : (
              <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>レシートはまだ撮影されていません</p>
            )}
          </div>
          <div className="space-y-4 text-sm">
            <dl className="space-y-2">
              <Row label="状態"><DeclarationStatusBadge status={d.status} /></Row>
              <Row label="合計">{yen(d.amount ?? d.entered_amount)}</Row>
              <Row label="支払い方法（レシート）">{d.receipt_payment_label ?? "—"}</Row>
              <Row label="カード下4桁（レシート）">{d.receipt_card_last4 ?? "印字なし"}</Row>
            </dl>
            <div>
              <h3 className="mb-2 font-bold">読み取った明細</h3>
              {d.receipt_items && d.receipt_items.length > 0 ? (
                <ul className="divide-y" style={{ borderColor: "var(--qolc-border)" }}>
                  {d.receipt_items.map((item, i) => (
                    <li key={i} className="flex justify-between py-2">
                      <span>{item.name}</span>
                      <span>{yen(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: "var(--qolc-muted)" }}>明細はありません</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 見出しと値の1行 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt style={{ color: "var(--qolc-muted)" }}>{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
