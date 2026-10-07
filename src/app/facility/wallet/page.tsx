"use client";

/**
 * 施設ポータル「お買い物」：外出時の支払いの記録を、入居者別・月別に見る（閲覧中心）。
 * 開発指示書 09 の 10.1 F1。記録の作成は iPhone アプリで行う。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ReceiptDialog } from "@/components/wallet/receipt-dialog";
import { DeclarationStatusBadge, jstDateTime, yen } from "@/components/wallet/wallet-status";
import type { DeclarationDto } from "@/lib/wallet/declarations";
import { monthRange, residentTotals, shiftMonth } from "@/lib/wallet/portal";

/** お買い物の一覧 */
export default function FacilityWalletPage() {
  const [month, setMonth] = useState(() => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 7));
  const [rows, setRows] = useState<DeclarationDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeclarationDto | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    const { from, to } = monthRange(month);
    const res = await fetch(`/api/wallet/declarations?from=${from}&to=${to}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      setError(json?.error ?? "読み込めませんでした");
      setRows([]);
      return;
    }
    setRows((json.data.declarations as DeclarationDto[]).filter((d) => d.status !== "cancelled"));
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => residentTotals(rows ?? []), [rows]);

  return (
    <PortalLayout portal="facility">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/facility/dashboard" }, { label: "お買い物" }]} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">お買い物</h1>
        <div className="flex items-center gap-2">
          <MonthButton label="前の月" onClick={() => setMonth(shiftMonth(month, -1))} />
          <span className="min-w-[7rem] text-center text-lg font-bold">{month.replace("-", "年")}月</span>
          <MonthButton label="次の月" onClick={() => setMonth(shiftMonth(month, 1))} />
          <MonthButton label="読み直す" onClick={() => void load()} />
        </div>
      </div>
      <p className="mb-4 text-sm" style={{ color: "var(--qolc-muted)" }}>
        外出のときに iPhone で記録した支払いです。行を押すと、レシートの画像と明細を見られます。
      </p>

      {error && <p className="mb-3 text-sm" style={{ color: "#DC2626" }}>{error}</p>}

      {!rows ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="この月のお買い物の記録はありません" description="iPhone アプリで支払いを記録すると、ここに表示されます。" />
      ) : (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {totals.map((t) => (
              <div key={t.residentId} className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--qolc-border)" }}>
                <p className="font-bold">{t.residentName} さん</p>
                <p className="text-2xl font-bold" style={{ color: "var(--qolc-primary, #4C986A)" }}>{yen(t.total)}</p>
                <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                  {t.count}件{t.awaitingReceipt > 0 ? `・レシート待ち ${t.awaitingReceipt}件` : ""}
                </p>
              </div>
            ))}
          </section>
          <DataTable<DeclarationDto>
            rowKey={(r) => r.id}
            data={rows}
            onRowClick={(r) => setSelected(r)}
            columns={[
              { key: "paid_at", header: "日時", render: (r) => jstDateTime(r.paid_at ?? r.selected_at) },
              { key: "resident_name", header: "入居者", render: (r) => `${r.resident_name} さん` },
              { key: "merchant_name", header: "お店", render: (r) => r.merchant_name ?? "—" },
              { key: "amount", header: "金額", render: (r) => yen(r.amount ?? r.entered_amount) },
              { key: "status", header: "状態", render: (r) => <DeclarationStatusBadge status={r.status} /> },
              {
                key: "receipt_image_url",
                header: "レシート",
                render: (r) =>
                  r.receipt_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 署名付き URL のサムネイル
                    <img src={r.receipt_image_url} alt="レシート" className="h-14 w-10 rounded border object-cover" />
                  ) : (
                    <span style={{ color: "var(--qolc-muted)" }}>未撮影</span>
                  ),
              },
            ]}
          />
        </>
      )}
      {selected && <ReceiptDialog declaration={selected} onClose={() => setSelected(null)} />}
    </PortalLayout>
  );
}

/** 月の切り替えなどのボタン（44px 以上） */
function MonthButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded border bg-white px-4 text-sm" style={{ minHeight: 44, borderColor: "var(--qolc-border)" }}>
      {label}
    </button>
  );
}
