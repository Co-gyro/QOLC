"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import {
  fetchUploadBatches,
  UPLOAD_STATUS_LABEL,
  UPLOAD_STATUS_COLOR,
  UPLOAD_STATUS_DESCRIPTION,
  type UploadBatchRow,
} from "@/lib/portal/upload-history-queries";
import type { ApiResponse } from "@/types/api";
import type { PreviewResult } from "@/lib/upload/preview";

export interface UploadHistoryProps {
  /** マウント時の自動再取得トリガー（決済実行後などに変更して再読込） */
  refreshKey?: number;
  /** 表示する加盟店名列の見出し（provider視点では不要なら hideMerchant） */
  hideMerchant?: boolean;
}

/** バッチ詳細APIのレスポンス */
interface BatchDetail {
  batch: {
    id: string;
    fileName: string | null;
    providerType: string;
    status: string;
    totalAmount: number;
    totalRows: number;
    createdAt: string;
  };
  preview: PreviewResult;
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
  const [openId, setOpenId] = useState<string | null>(null);

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
    <>
      <StatusLegend />
      <p className="text-xs mb-2" style={{ color: "var(--qolc-muted)" }}>
        行をクリックすると中身（入居者別の内訳）を確認できます。
      </p>
      <DataTable<UploadBatchRow>
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
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
      {openId && <BatchDetailModal batchId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

/** 状態の凡例（各状態を1行ずつ縦並びで表示） */
function StatusLegend() {
  const order = ["processing", "preview", "completed", "error"];
  return (
    <div className="flex flex-col gap-1 mb-3 text-xs" style={{ color: "var(--qolc-muted)" }}>
      {order.map((s) => (
        <div key={s} className="flex items-center gap-2">
          <span className="shrink-0 w-20"><StatusChip status={s} /></span>
          <span>{UPLOAD_STATUS_DESCRIPTION[s]}</span>
        </div>
      ))}
    </div>
  );
}

/** バッチ詳細モーダル（行クリックで中身を表示） */
function BatchDetailModal({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const [data, setData] = useState<BatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/upload/${batchId}`);
        const json = (await res.json()) as ApiResponse<BatchDetail>;
        if (!active) return;
        if (!json.success) setError(json.error);
        else setData(json.data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "取得に失敗しました");
      }
    })();
    return () => {
      active = false;
    };
  }, [batchId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--qolc-border)" }}>
          <h3 className="text-lg font-semibold">アップロード内容</h3>
          <button onClick={onClose} className="text-2xl leading-none px-2" style={{ color: "var(--qolc-muted)" }} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="p-4">
          {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}
          {!error && !data && <div className="py-6 flex justify-center"><LoadingSpinner /></div>}
          {data && <BatchDetailBody detail={data} />}
        </div>
      </div>
    </div>
  );
}

function BatchDetailBody({ detail }: { detail: BatchDetail }) {
  const { batch, preview } = detail;
  return (
    <>
      <div className="mb-4 text-sm space-y-1">
        <div className="flex justify-between">
          <span style={{ color: "var(--qolc-muted)" }}>ファイル</span>
          <span className="font-medium">{batch.fileName ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: "var(--qolc-muted)" }}>状態</span>
          <span className="flex items-center gap-2">
            <StatusChip status={batch.status} />
          </span>
        </div>
        <p className="text-xs pt-1" style={{ color: "var(--qolc-muted)" }}>
          {UPLOAD_STATUS_DESCRIPTION[batch.status] ?? ""}
        </p>
        <div className="flex justify-between pt-1">
          <span style={{ color: "var(--qolc-muted)" }}>合計</span>
          <span className="font-semibold">{yen(batch.totalAmount)}</span>
        </div>
      </div>

      {preview.facilities.length === 0 && preview.unmatched.length === 0 && (
        <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>明細はありません。</p>
      )}

      {preview.facilities.map((f) => (
        <div key={f.facilityId ?? "none"} className="mb-4 last:mb-0">
          <h4 className="font-semibold mb-1">
            {f.facilityName}
            <span className="ml-2 text-sm font-normal" style={{ color: "var(--qolc-muted)" }}>
              （{f.residents.length}名、合計 {yen(f.totalAmount)}）
            </span>
          </h4>
          <ul className="ml-2 space-y-2">
            {f.residents.map((r) => (
              <li key={r.residentId} className="border-b pb-2 text-sm">
                <div className="flex justify-between font-medium">
                  <span>{r.residentName}</span>
                  <span>{yen(r.totalAmount)}</span>
                </div>
                {/* 区分（保険/その他費用）別の内訳 */}
                <ul className="ml-3 mt-1 space-y-0.5" style={{ color: "var(--qolc-muted)" }}>
                  {r.lines.map((l) => (
                    <li key={l.statementLineId} className="flex justify-between text-xs">
                      <span>{l.serviceName ?? "明細"}</span>
                      <span>{yen(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {preview.unmatched.length > 0 && (
        <div className="mt-3 p-3 rounded text-sm" style={{ backgroundColor: "#FFF7E6" }}>
          <p className="font-semibold mb-1" style={{ color: "#B45309" }}>
            施設・入居者 未確定（{preview.unmatched.length}件）
          </p>
          <ul className="ml-2 space-y-0.5 text-xs">
            {preview.unmatched.map((u) => (
              <li key={u.statementLineId} className="flex justify-between">
                <span>被保険者番号: {u.insuranceNumber || "(空)"}</span>
                <span>{yen(u.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
