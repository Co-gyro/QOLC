"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import {
  fetchUploadBatches,
  UPLOAD_STATUS_LABEL,
  UPLOAD_STATUS_COLOR,
  type UploadBatchRow,
} from "@/lib/portal/upload-history-queries";

export interface UploadHistoryProps {
  /** マウント時の自動再取得トリガー（決済実行後などに変更して再読込） */
  refreshKey?: number;
  /** 表示する加盟店名列の見出し（provider視点では不要なら hideMerchant） */
  hideMerchant?: boolean;
}

function StatusChip({ status }: { status: string }) {
  const c = UPLOAD_STATUS_COLOR[status] ?? { bg: "#F3F4F6", fg: "#4B5563" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: c.bg, color: c.fg }}>
      {UPLOAD_STATUS_LABEL[status] ?? status}
    </span>
  );
}

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export function UploadHistory({ refreshKey = 0, hideMerchant = false }: UploadHistoryProps) {
  const [rows, setRows] = useState<UploadBatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchUploadBatches());
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load, refreshKey]);

  if (error) return <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>;
  if (!rows) return <LoadingSpinner />;
  if (rows.length === 0) {
    return <EmptyState title="アップロード履歴がありません" description="明細をアップロードすると、ここに表示されます。" />;
  }

  return (
    <DataTable<UploadBatchRow>
      rowKey={(r) => r.id}
      columns={[
        {
          key: "createdAt",
          header: "日時",
          sortable: true,
          render: (r) => new Date(r.createdAt).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" }),
        },
        { key: "fileName", header: "ファイル", render: (r) => r.fileName ?? "—" },
        ...(hideMerchant ? [] : [{ key: "merchantName" as const, header: "加盟店" }]),
        {
          key: "providerType",
          header: "種別",
          render: (r) => (r.providerType === "facility_self" ? "施設" : "提供者"),
        },
        { key: "totalRows", header: "件数", className: "text-right" },
        { key: "totalAmount", header: "金額", render: (r) => yen(r.totalAmount), className: "text-right" },
        { key: "status", header: "状態", render: (r) => <StatusChip status={r.status} /> },
      ]}
      data={rows}
    />
  );
}
