"use client";

import { useEffect, useState, useCallback } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchPayments, type PaymentListRow } from "@/lib/portal/payment-queries";
import type { PaymentStatus } from "@/types";

const STATUS_FILTERS: { value: PaymentStatus | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "保留" },
  { value: "captured", label: "完了" },
  { value: "failed", label: "失敗" },
];

export default function FacilityPaymentsPage() {
  const [rows, setRows] = useState<PaymentListRow[] | null>(null);
  const [filter, setFilter] = useState<PaymentStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      const data = await fetchPayments(filter === "all" ? undefined : filter);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setRows([]);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PortalLayout portal="facility">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/facility/dashboard" }, { label: "決済状況" }]} />
      <h1 className="text-2xl font-bold mb-4">決済状況</h1>

      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm" style={{ color: "var(--qolc-muted)" }}>
          ステータス:
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as PaymentStatus | "all")}
          className="border rounded px-3 py-2 text-sm"
          style={{ borderColor: "var(--qolc-border)", minHeight: 40 }}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm mb-3" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      {!rows ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState
          title="決済データがありません"
          description="明細がアップロードされ決済が実行されると、ここに表示されます。"
        />
      ) : (
        <DataTable<PaymentListRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "date", header: "日付", sortable: true },
            { key: "residentName", header: "入居者", sortable: true },
            { key: "merchantName", header: "提供者", sortable: true },
            {
              key: "amount",
              header: "金額",
              sortable: true,
              render: (r) => `¥${r.amount.toLocaleString("ja-JP")}`,
              className: "text-right",
            },
            {
              key: "status",
              header: "状態",
              render: (r) => <StatusBadge status={r.status} />,
            },
          ]}
          data={rows}
        />
      )}
    </PortalLayout>
  );
}
