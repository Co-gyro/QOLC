"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { loadFacilities, type FacilityRow } from "@/lib/portal/mock-loaders";

export default function ProviderFacilitiesPage() {
  const [facilities, setFacilities] = useState<FacilityRow[] | null>(null);
  useEffect(() => {
    void loadFacilities().then(setFacilities);
  }, []);
  return (
    <PortalLayout portal="provider">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/provider/dashboard" }, { label: "取引先施設" }]} />
      <h1 className="text-2xl font-bold mb-4">取引先施設一覧</h1>
      {!facilities ? (
        <LoadingSpinner />
      ) : (
        <DataTable<FacilityRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "施設名", sortable: true },
            { key: "residentCount", header: "入居者数", sortable: true, className: "text-right" },
          ]}
          data={facilities}
        />
      )}
    </PortalLayout>
  );
}
