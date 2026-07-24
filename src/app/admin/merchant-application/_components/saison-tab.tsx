"use client";

/**
 * 申請書作成画面のセゾンタブ（JCBタブと同じ動線で審査FMT Excelを出力する）
 *
 * - applicationId あり: 案件を読み込み、セゾン申込書のダウンロードを表示
 * - applicationId なし: セゾンは案件データから自動転記のため、案件から開く必要がある旨を案内
 */
import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { SaisonDocSection } from "@/components/applications/saison-doc-section";
import { fetchApplicationDetail } from "@/lib/applications/client";
import type { ApplicationDetail } from "@/lib/applications/types";

export interface SaisonTabProps {
  applicationId: string | null;
}

export function SaisonTab({ applicationId }: SaisonTabProps) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!applicationId) return;
    fetchApplicationDetail(applicationId)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "案件の取得に失敗しました"));
  }, [applicationId]);

  if (!applicationId) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
          セゾン申込書（審査FMT）は案件の申請内容・UD追記・採番値から自動転記するため、
          案件を選んでからこの画面を開いてください。
        </p>
        <a
          href="/admin/applications"
          className="text-sm underline font-medium"
          style={{ color: "var(--qolc-primary)" }}
        >
          加盟店申請・登録の一覧から案件を開く →
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm" style={{ color: "#DC2626" }}>
        {error}
      </p>
    );
  }
  if (!detail) return <LoadingSpinner />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium" style={{ color: "var(--qolc-text)" }}>
        対象案件: {detail.applicantOrg ?? detail.applicantName ?? detail.id.slice(0, 8)}
      </p>
      <SaisonDocSection detail={detail} />
      <a
        href={`/admin/applications/${detail.id}`}
        className="text-sm underline font-medium"
        style={{ color: "var(--qolc-primary)" }}
      >
        案件詳細へ戻る（UD追記・採番の補完はこちら）
      </a>
    </div>
  );
}
