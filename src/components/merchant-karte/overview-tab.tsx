"use client";

import Link from "next/link";
import type { MerchantOverview } from "@/lib/admin/merchant-overview";
import { jstDate } from "./fmt";

/** ラベルと値の1行 */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-[#E0DDD8] py-2 last:border-0">
      <dt className="w-40 shrink-0 text-sm" style={{ color: "var(--qolc-muted)" }}>{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

/** 利用サービスのカード */
function ServiceCard({ title, children, href, hrefLabel }: { title: string; children: React.ReactNode; href?: string; hrefLabel?: string }) {
  return (
    <div className="rounded border border-[#E0DDD8] bg-white p-4">
      <h3 className="font-bold">{title}</h3>
      <div className="mt-2 space-y-1 text-sm">{children}</div>
      {href && <Link href={href} className="mt-2 inline-block text-sm text-[#3D7A55] underline">{hrefLabel}</Link>}
    </div>
  );
}

/**
 * 加盟店カルテ「概要」: 基本情報と、使っているサービスの状況。
 */
export function OverviewTab({ data }: { data: MerchantOverview }) {
  const { merchant: m, services: s } = data;
  const none = !s.udpay && !s.merchantApi && !s.qolc;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded border border-[#E0DDD8] bg-white p-4">
        <h2 className="mb-2 font-bold">基本情報</h2>
        <dl>
          <Row label="加盟店名" value={m.name} />
          <Row label="フリガナ" value={m.nameKana} />
          <Row label="住所" value={m.address} />
          <Row label="電話" value={m.phone} />
          <Row label="適格請求書の登録番号" value={m.invoiceRegistrationNumber} />
          <Row label="登録日" value={jstDate(m.createdAt)} />
        </dl>
      </section>
      <section className="space-y-3">
        <h2 className="font-bold">利用中のサービス</h2>
        {none && <p className="rounded border border-dashed border-[#E0DDD8] p-4 text-sm">まだサービスの利用設定がありません。</p>}
        {s.udpay && (
          <ServiceCard title="UD Payment（請求・カード決済）" href="/admin/udpay" hrefLabel="UD Payment の管理へ">
            <p>決済日: 毎月{s.udpay.chargeDays.join("日・")}日</p>
            <p>顧客 {s.udpay.customers}件（カード登録済み {s.udpay.cardRegistered}件）</p>
            <p>今月の課金: 入金済み {s.udpay.capturedThisMonth}件／与信落ち {s.udpay.failedThisMonth}件</p>
          </ServiceCard>
        )}
        {s.merchantApi && (
          <ServiceCard title="加盟店API（決済画面の提供）">
            {s.merchantApi.credentials.map((c) => (
              <p key={c.apiMerchantId}>
                {c.environment === "production" ? "本番" : "テスト"}: {c.apiMerchantId}（{c.status === "active" ? "有効" : c.status === "suspended" ? "停止中" : "失効"}）
              </p>
            ))}
            <p>直近30日の本番決済: 成功 {s.merchantApi.succeeded30d}件／失敗 {s.merchantApi.failed30d}件</p>
          </ServiceCard>
        )}
        {s.qolc && (
          <ServiceCard title="QOLC（介護施設向け）">
            <p>提携施設 {s.qolc.activeFacilities}件</p>
          </ServiceCard>
        )}
        <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
          契約状態・プラン名・利用人数の上限は「契約・ライセンス」タブで確認・変更できます。
        </p>
      </section>
    </div>
  );
}
