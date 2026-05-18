"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { loadMerchants, type MerchantRow } from "@/lib/portal/mock-loaders";

export default function AdminMerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantRow[] | null>(null);
  useEffect(() => {
    void loadMerchants().then(setMerchants);
  }, []);
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "加盟店管理" }]} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">加盟店管理</h1>
        <a
          href="/admin/merchant-application"
          className="qolc-btn px-4 py-2 rounded text-white font-medium inline-block"
          style={{ backgroundColor: "var(--qolc-primary)" }}
        >
          加盟店申請書を出力
        </a>
      </div>
      {!merchants ? (
        <LoadingSpinner />
      ) : (
        <DataTable<MerchantRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "加盟店名", sortable: true },
            { key: "category", header: "業種", sortable: true },
            { key: "facilityCount", header: "紐づく施設数", sortable: true, className: "text-right" },
            {
              key: "status",
              header: "状態",
              render: (r) => <StatusBadge status={r.status} />,
            },
          ]}
          data={merchants}
        />
      )}
    </PortalLayout>
  );
}
