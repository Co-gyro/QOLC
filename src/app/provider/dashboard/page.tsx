"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/shared/stat-card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { fetchProviderStats, type ProviderStats } from "@/lib/portal/dashboard-queries";

export default function ProviderDashboardPage() {
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviderStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"));
  }, []);

  return (
    <PortalLayout portal="provider">
      <Breadcrumb items={[{ label: "ダッシュボード" }]} />
      <h1 className="text-2xl font-bold mb-6">提供者ダッシュボード</h1>

      {error && <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{error}</p>}

      {!stats ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <StatCard label="取引先施設数" value={stats.facilityCount} unit="施設" />
            <StatCard label="今月のアップロード" value={stats.monthlyUploadCount} unit="件" />
            <StatCard label="今月の決済金額" value={stats.monthlyPaymentAmount} unit="円" emphasis />
          </div>
          <a
            href="/provider/upload"
            className="qolc-btn inline-block px-6 py-3 rounded text-white font-medium text-lg"
            style={{ backgroundColor: "var(--qolc-primary)" }}
          >
            明細をアップロード →
          </a>
        </>
      )}
    </PortalLayout>
  );
}
