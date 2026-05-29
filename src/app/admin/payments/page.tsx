"use client";

import { useEffect, useState, useCallback } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CancelPaymentDialog, type CancelPaymentTarget } from "@/components/forms/cancel-payment-dialog";
import {
  fetchPayments,
  summarizePayments,
  type PaymentListRow,
} from "@/lib/portal/payment-queries";
import type { PaymentStatus } from "@/types";

const STATUS_FILTERS: { value: PaymentStatus | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "保留" },
  { value: "authorized", label: "与信済" },
  { value: "captured", label: "完了" },
  { value: "failed", label: "失敗" },
  { value: "cancelled", label: "取消" },
  { value: "refunded", label: "返金" },
];

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<PaymentListRow[] | null>(null);
  const [filter, setFilter] = useState<PaymentStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelPaymentTarget | null>(null);

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

  const summary = rows ? summarizePayments(rows) : null;

  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "決済管理" }]} />
      <h1 className="text-2xl font-bold mb-4">決済管理</h1>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="件数" value={summary.total} unit="件" />
          <StatCard label="合計金額" value={summary.totalAmount} unit="円" emphasis />
          <StatCard label="保留" value={summary.byStatus["pending"]?.count ?? 0} unit="件" />
          <StatCard label="失敗" value={summary.byStatus["failed"]?.count ?? 0} unit="件" />
        </div>
      )}

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
          description="明細をアップロードして決済を実行すると、ここに表示されます。"
        />
      ) : (
        <DataTable<PaymentListRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "date", header: "日付", sortable: true },
            { key: "residentName", header: "入居者", sortable: true },
            { key: "merchantName", header: "加盟店", sortable: true },
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
            {
              key: "jutyuCd",
              header: "受注コード",
              render: (r) => r.jutyuCd ?? "—",
            },
            {
              key: "actions",
              header: "操作",
              render: (r) =>
                (r.status === "authorized" || r.status === "captured") && r.jutyuCd ? (
                  <Button
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    style={{ borderColor: "#DC2626", color: "#DC2626" }}
                    onClick={() =>
                      setCancelTarget({
                        id: r.id,
                        residentName: r.residentName,
                        merchantName: r.merchantName,
                        amount: r.amount,
                        status: r.status,
                        jutyuCd: r.jutyuCd,
                        capturedAt: r.capturedAt,
                      })
                    }
                  >
                    取消/返金
                  </Button>
                ) : (
                  <span style={{ color: "var(--qolc-muted)" }}>—</span>
                ),
            },
          ]}
          data={rows}
        />
      )}

      <CancelPaymentDialog
        target={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onDone={() => void load()}
      />
    </PortalLayout>
  );
}
