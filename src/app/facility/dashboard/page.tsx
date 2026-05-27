"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchFacilityStats, type FacilityStats } from "@/lib/portal/dashboard-queries";
import type { PaymentListRow } from "@/lib/portal/payment-queries";

export default function FacilityDashboardPage() {
  const [stats, setStats] = useState<FacilityStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFacilityStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"));
  }, []);

  return (
    <PortalLayout portal="facility">
      <Breadcrumb items={[{ label: "ダッシュボード" }]} />
      <h1 className="text-2xl font-bold mb-6">施設ダッシュボード</h1>

      {error && <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{error}</p>}

      {!stats ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="入居者数" value={stats.residentCount} unit="名" />
            <StatCard label="今月の決済件数" value={stats.monthlyPaymentCount} unit="件" emphasis />
            <StatCard label="今月の決済金額" value={stats.monthlyPaymentAmount} unit="円" emphasis />
            <StatCard label="カード未登録者" value={stats.cardUnregisteredCount} unit="名" />
          </div>

          <section>
            <h2 className="text-lg font-semibold mb-3">直近の決済</h2>
            {stats.recentPayments.length === 0 ? (
              <EmptyState title="決済データがありません" description="明細アップロード・決済実行すると表示されます。" />
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
                    render: (r) => `¥${r.amount.toLocaleString("ja-JP")}`,
                    className: "text-right",
                  },
                  { key: "status", header: "状態", render: (r) => <StatusBadge status={r.status} /> },
                ]}
                data={stats.recentPayments}
              />
            )}
          </section>
        </>
      )}
    </PortalLayout>
  );
}
