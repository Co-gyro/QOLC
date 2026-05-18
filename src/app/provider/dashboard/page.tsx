"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/shared/stat-card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import {
  loadFacilities,
  loadPayments,
  type FacilityRow,
  type PaymentRow,
} from "@/lib/portal/mock-loaders";

export default function ProviderDashboardPage() {
  const [facilities, setFacilities] = useState<FacilityRow[] | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);

  useEffect(() => {
    void loadFacilities().then(setFacilities);
    void loadPayments().then(setPayments);
  }, []);

  if (!facilities || !payments) {
    return (
      <PortalLayout portal="provider">
        <LoadingSpinner />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout portal="provider">
      <Breadcrumb items={[{ label: "ダッシュボード" }]} />
      <h1 className="text-2xl font-bold mb-6">提供者ダッシュボード</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="取引先施設数" value={facilities.length} unit="施設" />
        <StatCard label="今月のアップロード" value={1} unit="件" />
        <StatCard
          label="今月の決済金額"
          value={payments.reduce((s, p) => s + p.amount, 0)}
          unit="円"
          emphasis
        />
      </div>
      <a
        href="/provider/upload"
        className="qolc-btn inline-block px-6 py-3 rounded text-white font-medium text-lg"
        style={{ backgroundColor: "var(--qolc-primary)" }}
      >
        明細をアップロード →
      </a>
    </PortalLayout>
  );
}
