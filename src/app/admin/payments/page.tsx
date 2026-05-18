"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { loadPayments, type PaymentRow } from "@/lib/portal/mock-loaders";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  useEffect(() => {
    void loadPayments().then(setPayments);
  }, []);
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "決済管理" }]} />
      <h1 className="text-2xl font-bold mb-4">決済管理</h1>
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
    </PortalLayout>
  );
}
