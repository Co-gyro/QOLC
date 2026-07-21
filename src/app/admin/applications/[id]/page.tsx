"use client";

/**
 * /admin/applications/[id] … 加盟店申請・登録の案件詳細（作業ページ）
 * 記載内容の確認 → 登録手続き（採番・UD追記・申請書・審査・変換）→ 対応の記録。
 */
import { useParams } from "next/navigation";
import { ApplicationDetailPage } from "@/components/applications/detail-page";

export default function MerchantApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <ApplicationDetailPage
      applicationId={params.id}
      listHref="/admin/applications"
      listLabel="加盟店申請・登録"
    />
  );
}
