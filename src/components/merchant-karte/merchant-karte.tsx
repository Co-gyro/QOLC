"use client";

import { useEffect, useState } from "react";
import type { MerchantOverview } from "@/lib/admin/merchant-overview";
import { udpayAdminFetch } from "@/components/udpay-admin/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./overview-tab";
import { AccountsTab } from "./accounts-tab";
import { ConnectionTab } from "./connection-tab";
import { CardTab } from "./card-tab";
import { ContractsTab } from "./contracts-tab";

/** 準備中のタブの説明 */
function Upcoming({ text }: { text: string }) {
  return <p className="rounded border border-dashed border-[#E0DDD8] p-4 text-sm">{text}</p>;
}

/**
 * 加盟店カルテ: 加盟店ごとの契約・利用者・接続情報・カード会社の情報を1ページにまとめる。
 * 問い合わせが来たら、ここを開けば状況がわかることを目的にする。
 */
export function MerchantKarte({ merchantId }: { merchantId: string }) {
  const [data, setData] = useState<MerchantOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    udpayAdminFetch<MerchantOverview>(`/api/admin/merchants/${merchantId}/overview`).then(setData).catch((e: Error) => setError(e.message));
  }, [merchantId]);
  if (error) return <p className="rounded bg-[#FEE2E2] p-3 text-[#991B1B]">{error}</p>;
  if (!data) return <p>読み込み中…</p>;
  const s = data.services;
  const badges = [s.udpay && "UD Payment", s.merchantApi && "加盟店API", s.qolc && "QOLC"].filter(Boolean) as string[];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{data.merchant.name}</h1>
        {badges.map((b) => (
          <span key={b} className="rounded-full bg-[#F0F9F4] px-3 py-0.5 text-sm font-bold text-[#3D7A55]">{b}</span>
        ))}
        {data.merchant.mallCode && <span className="text-sm" style={{ color: "var(--qolc-muted)" }}>モール {data.merchant.mallCode}</span>}
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="contracts">契約・ライセンス</TabsTrigger>
          <TabsTrigger value="accounts">利用者</TabsTrigger>
          <TabsTrigger value="connection">接続情報</TabsTrigger>
          <TabsTrigger value="card">カード会社・精算</TabsTrigger>
          <TabsTrigger value="history">履歴</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab data={data} /></TabsContent>
        <TabsContent value="contracts"><ContractsTab merchantId={merchantId} /></TabsContent>
        <TabsContent value="accounts"><AccountsTab merchantId={merchantId} hasUdpay={Boolean(s.udpay)} /></TabsContent>
        <TabsContent value="connection"><ConnectionTab data={data} /></TabsContent>
        <TabsContent value="card"><CardTab data={data} /></TabsContent>
        <TabsContent value="history">
          <Upcoming text="準備中です。アカウントの発行・パスワード設定メール・停止、接続情報の発行、契約の変更、送ったメールの記録を時系列で表示します（操作の記録自体はすでに残しています）。" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
