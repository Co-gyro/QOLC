"use client";

import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { UploadFlow } from "@/components/shared/upload-flow";

/**
 * 提供者ポータル: 明細アップロード。
 * フロー本体は UploadFlow（施設ポータルの代行アップロードと共通）。
 * merchantId は渡さない＝API側でログイン中提供者の加盟店に固定される。
 */
export default function ProviderUploadPage() {
  return (
    <PortalLayout portal="provider">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/provider/dashboard" }, { label: "明細アップロード" }]} />
      <h1 className="text-2xl font-bold mb-2">明細アップロード</h1>
      <p className="text-sm mb-6" style={{ color: "var(--qolc-muted)" }}>
        ①明細・②その他費用はどちらから入れてもOKです。1回の取込み（同じまとめ）に合算され、入居者ごとに1決済になります。
      </p>
      <UploadFlow hideMerchantInHistory />
    </PortalLayout>
  );
}
