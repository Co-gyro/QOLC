"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { loadResidents, type ResidentRow } from "@/lib/portal/mock-loaders";

export default function FacilityResidentsPage() {
  const [residents, setResidents] = useState<ResidentRow[] | null>(null);
  useEffect(() => {
    void loadResidents().then(setResidents);
  }, []);
  return (
    <PortalLayout portal="facility">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/facility/dashboard" }, { label: "入居者管理" }]} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">入居者管理</h1>
        <button
          className="qolc-btn px-4 py-2 rounded text-white font-medium"
          style={{ backgroundColor: "var(--qolc-primary)" }}
        >
          + 入居者を登録
        </button>
      </div>
      {!residents ? (
        <LoadingSpinner />
      ) : (
        <DataTable<ResidentRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "氏名", sortable: true },
            { key: "insuranceNumber", header: "被保険者番号" },
            {
              key: "cardRegistered",
              header: "カード登録",
              render: (r) => (
                <StatusBadge status={r.cardRegistered ? "active" : "inactive"} />
              ),
            },
            {
              key: "ownerName",
              header: "支払い担当",
              render: (r) => r.ownerName ?? "(未設定)",
            },
          ]}
          data={residents}
        />
      )}
    </PortalLayout>
  );
}
