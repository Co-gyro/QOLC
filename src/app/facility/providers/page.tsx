"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchFacilityProviders, type LinkedMerchantRow } from "@/lib/portal/relation-queries";

export default function FacilityProvidersPage() {
  const [rows, setRows] = useState<LinkedMerchantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFacilityProviders()
      .then(setRows)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "取得に失敗しました");
        setRows([]);
      });
  }, []);

  return (
    <PortalLayout portal="facility">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/facility/dashboard" }, { label: "サービス提供者" }]} />
      <h1 className="text-2xl font-bold mb-4">サービス提供者</h1>
      {error && <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{error}</p>}
      {!rows ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="提携している提供者がいません" description="運営者が加盟店との提携を設定すると表示されます。" />
      ) : (
        <DataTable<LinkedMerchantRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "提供者名", sortable: true },
            { key: "mallCode", header: "モールコード", render: (r) => r.mallCode ?? "—" },
            {
              key: "status",
              header: "状態",
              render: (r) => <StatusBadge status={r.status === "active" ? "active" : "inactive"} />,
            },
          ]}
          data={rows}
        />
      )}
    </PortalLayout>
  );
}
