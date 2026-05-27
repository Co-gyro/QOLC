"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchProviderFacilities, type LinkedFacilityRow } from "@/lib/portal/relation-queries";

export default function ProviderFacilitiesPage() {
  const [rows, setRows] = useState<LinkedFacilityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviderFacilities()
      .then(setRows)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "取得に失敗しました");
        setRows([]);
      });
  }, []);

  return (
    <PortalLayout portal="provider">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/provider/dashboard" }, { label: "取引先施設" }]} />
      <h1 className="text-2xl font-bold mb-4">取引先施設一覧</h1>
      {error && <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{error}</p>}
      {!rows ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="取引先施設がありません" description="施設と提携すると、ここに表示されます。" />
      ) : (
        <DataTable<LinkedFacilityRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "施設名", sortable: true },
            { key: "residentCount", header: "入居者数", sortable: true, className: "text-right" },
          ]}
          data={rows}
        />
      )}
    </PortalLayout>
  );
}
