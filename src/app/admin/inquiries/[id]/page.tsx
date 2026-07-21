"use client";

/**
 * /admin/inquiries/[id] … 相談・問い合わせの案件詳細（作業ページ）
 * 記載内容を読む → 連絡する → 対応を記録する（記録で状態が自動で進む）。
 */
import { useParams } from "next/navigation";
import { ApplicationDetailPage } from "@/components/applications/detail-page";

export default function InquiryDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <ApplicationDetailPage
      applicationId={params.id}
      listHref="/admin/inquiries"
      listLabel="相談・問い合わせ"
    />
  );
}
