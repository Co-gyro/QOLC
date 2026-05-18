"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { loadMerchants, type MerchantRow } from "@/lib/portal/mock-loaders";

export default function FacilityProvidersPage() {
  const [merchants, setMerchants] = useState<MerchantRow[] | null>(null);
  useEffect(() => {
    void loadMerchants().then(setMerchants);
  }, []);
  return (
    <PortalLayout portal="facility">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/facility/dashboard" }, { label: "サービス提供者" }]} />
      <h1 className="text-2xl font-bold mb-4">サービス提供者</h1>
      {!merchants ? (
        <LoadingSpinner />
      ) : (
        <DataTable<MerchantRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "提供者名", sortable: true },
            { key: "category", header: "業種" },
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
