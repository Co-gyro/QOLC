"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import {
  loadPayments,
  loadResidents,
  type PaymentRow,
  type ResidentRow,
} from "@/lib/portal/mock-loaders";

export default function FacilityDashboardPage() {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [residents, setResidents] = useState<ResidentRow[] | null>(null);

  useEffect(() => {
    void loadPayments().then(setPayments);
    void loadResidents().then(setResidents);
  }, []);

  const unregistered = residents
    ? residents.filter((r) => !r.cardRegistered).length
    : 0;
  const monthlyAmount = payments
    ? payments.reduce((s, p) => s + p.amount, 0)
    : 0;

  return (
    <PortalLayout portal="facility">
      <Breadcrumb items={[{ label: "ダッシュボード" }]} />
      <h1 className="text-2xl font-bold mb-6">施設ダッシュボード</h1>
      {!residents || !payments ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="入居者数" value={residents.length} unit="名" />
            <StatCard label="今月の決済件数" value={payments.length} unit="件" emphasis />
            <StatCard label="今月の決済金額" value={monthlyAmount} unit="円" emphasis />
            <StatCard label="カード未登録者" value={unregistered} unit="名" />
          </div>
          <section>
            <h2 className="text-lg font-semibold mb-3">直近の決済</h2>
            <DataTable<PaymentRow>
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
                {
                  key: "status",
                  header: "状態",
                  render: (r) => <StatusBadge status={r.status} />,
                },
              ]}
              data={payments}
            />
          </section>
        </>
      )}
    </PortalLayout>
  );
}
