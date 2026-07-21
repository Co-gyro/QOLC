"use client";

/**
 * /admin/inquiries … 相談・問い合わせ（業務ファースト構成）
 *
 * 客層が異なるため一覧はタブで分離する:
 * 住み替え相談（ご家族・B2C）／事業者問い合わせ（B2B）／既存顧客サポート。
 * 動線: 開く → 記載内容を読む → 連絡する → 対応を記録する（記録で状態が進む）。
 */
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ApplicationsHubView } from "@/components/applications/hub-view";
import { INQUIRY_HUB_TABS } from "@/lib/applications/hub-tabs";

export default function AdminInquiriesPage() {
  // useSearchParams（hub-view 内）はプリレンダ時に Suspense 境界が必須
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ApplicationsHubView
        title="相談・問い合わせ"
        description="窓口ごとに届いた相談・問い合わせを確認し、連絡・対応を記録します。電話受付は右上の起票ボタンでその場で記録できます。"
        basePath="/admin/inquiries"
        tabs={INQUIRY_HUB_TABS}
      />
    </Suspense>
  );
}
