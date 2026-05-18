"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import {
  loadAdminStats,
  loadPayments,
  type DashboardStats,
  type PaymentRow,
} from "@/lib/portal/mock-loaders";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);

  useEffect(() => {
    void loadAdminStats().then(setStats);
    void loadPayments().then(setPayments);
  }, []);

  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "ダッシュボード" }]} />
      <h1 className="text-2xl font-bold mb-6">運営者ダッシュボード</h1>

      {!stats ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="総施設数" value={stats.facilityCount} unit="施設" />
          <StatCard label="総入居者数" value={stats.residentCount} unit="名" />
          <StatCard label="今月の決済件数" value={stats.monthlyPaymentCount} unit="件" emphasis />
          <StatCard label="今月の決済金額" value={stats.monthlyPaymentAmount} unit="円" emphasis />
          <StatCard label="エラー件数" value={stats.errorCount} unit="件" />
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">直近の決済</h2>
        {!payments ? (
          <LoadingSpinner />
        ) : (
          <DataTable<PaymentRow>
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
            ]}
            data={payments}
          />
        )}
      </section>
    </PortalLayout>
  );
}
