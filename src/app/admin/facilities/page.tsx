"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { loadFacilities, type FacilityRow } from "@/lib/portal/mock-loaders";

export default function AdminFacilitiesPage() {
  const [facilities, setFacilities] = useState<FacilityRow[] | null>(null);
  useEffect(() => {
    void loadFacilities().then(setFacilities);
  }, []);
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "介護施設管理" }]} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">介護施設管理</h1>
        <button
          className="qolc-btn px-4 py-2 rounded text-white font-medium"
          style={{ backgroundColor: "var(--qolc-primary)" }}
        >
          + 施設を登録
        </button>
      </div>
      {!facilities ? (
        <LoadingSpinner />
      ) : (
        <DataTable<FacilityRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "施設名", sortable: true },
            { key: "residentCount", header: "入居者数", sortable: true, className: "text-right" },
            { key: "mallCode", header: "モールコード", sortable: true },
            {
              key: "monthlyPayment",
              header: "今月の決済額",
              sortable: true,
              render: (r) => `¥${r.monthlyPayment.toLocaleString("ja-JP")}`,
              className: "text-right",
            },
          ]}
          data={facilities}
        />
      )}
    </PortalLayout>
  );
}
