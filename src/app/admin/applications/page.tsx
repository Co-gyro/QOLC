"use client";

/**
 * /admin/applications … 加盟店申請・登録（業務ファースト構成）
 *
 * フォーム受付から審査・登録（稼働開始）までを1本の業務として扱う。
 * 一覧はステージ別リスト。相談・問い合わせ系は /admin/inquiries に分離した。
 */
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ApplicationsHubView } from "@/components/applications/hub-view";
import { MERCHANT_HUB_TABS } from "@/lib/applications/hub-tabs";

export default function AdminApplicationsPage() {
  // useSearchParams（hub-view 内）はプリレンダ時に Suspense 境界が必須
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ApplicationsHubView
        title="加盟店申請・登録"
        description="フォーム受付から採番・申請書作成・提出・審査結果・登録までを案件ごとに進めます。完了した加盟店は加盟店台帳に載ります。"
        basePath="/admin/applications"
        tabs={MERCHANT_HUB_TABS}
      />
    </Suspense>
  );
}
