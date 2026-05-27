"use client";

import { useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { FileUpload } from "@/components/shared/file-upload";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UploadHistory } from "@/components/shared/upload-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiResponse } from "@/types/api";
import type { PreviewResult } from "@/lib/upload/preview";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/** /api/payment/execute の結果型（payment-service.ProcessBatchResult に対応） */
interface ExecuteResult {
  total: number;
  success: number;
  failed: number;
  pending: number;
}

export default function ProviderUploadPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  async function handleFile(file: File) {
    setError(null);
    setPreview(null);
    setFileName(file.name);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as ApiResponse<PreviewResult>;
      if (!json.success) {
        setError(json.error);
        setLoading(false);
        return;
      }
      setPreview(json.data);
      setHistoryKey((k) => k + 1); // バッチ作成 → 履歴更新
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPreview(null);
    setFileName(null);
    setError(null);
    setResult(null);
  }

  async function executePayment() {
    if (!preview) return;
    setConfirming(false);
    setExecuting(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadBatchId: preview.batchId }),
      });
      const json = (await res.json()) as ApiResponse<ExecuteResult>;
      if (!json.success) {
        setError(json.error);
        setExecuting(false);
        return;
      }
      setResult(json.data);
      setHistoryKey((k) => k + 1); // 実行完了 → 履歴更新
    } catch (e) {
      setError(e instanceof Error ? e.message : "決済実行に失敗しました");
    } finally {
      setExecuting(false);
    }
  }

  const matchedCount = preview
    ? preview.facilities.reduce((s, f) => s + f.residents.length, 0)
    : 0;
  const unmatchedCount = preview
    ? preview.facilities.reduce((s, f) => s + f.unmatched.length, 0) +
      preview.unmatched.length
    : 0;

  return (
    <PortalLayout portal="provider">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/provider/dashboard" }, { label: "明細アップロード" }]} />
      <h1 className="text-2xl font-bold mb-6">明細アップロード</h1>

      {!preview && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>CSVファイルを選択</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              onFile={handleFile}
              helperText="被保険者番号を含む明細CSVをアップロードしてください（ヘッダー行必須、最大10MB）。"
            />
            {error && (
              <p className="text-sm mt-3" style={{ color: "#DC2626" }}>
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="py-8 flex justify-center">
            <LoadingSpinner size="lg" label={`${fileName ?? "ファイル"} を処理中...`} />
          </CardContent>
        </Card>
      )}

      {preview && !result && !executing && (
        <>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>
                プレビュー（マッチ {matchedCount}名 / 未マッチ {unmatchedCount}件 / 合計{" "}
                {yen(preview.totalAmount)}）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {preview.facilities.length === 0 && preview.unmatched.length === 0 && (
                <p style={{ color: "var(--qolc-muted)" }}>明細がありませんでした。</p>
              )}

              {preview.facilities.map((f) => (
                <div key={f.facilityId ?? "none"} className="mb-6 last:mb-0">
                  <h3 className="font-semibold text-lg mb-2">
                    {f.facilityName}
                    <span className="ml-2 text-sm font-normal" style={{ color: "var(--qolc-muted)" }}>
                      （{f.residents.length}名、合計 {yen(f.totalAmount)}）
                    </span>
                  </h3>
                  <ul className="ml-4 space-y-1">
                    {f.residents.map((r) => (
                      <li key={r.residentId} className="flex justify-between border-b py-1 text-sm">
                        <span>├ {r.residentName}</span>
                        <span className="font-medium">{yen(r.totalAmount)}</span>
                      </li>
                    ))}
                    {f.unmatched.map((u) => (
                      <li
                        key={u.statementLineId}
                        className="flex justify-between border-b py-1 text-sm"
                        style={{ color: "#B45309" }}
                      >
                        <span>？被保険者番号: {u.insuranceNumber || "(空)"}</span>
                        <span>
                          {yen(u.amount)} <StatusBadge status={u.matchStatus} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {preview.unmatched.length > 0 && (
                <div className="mt-4 p-3 rounded" style={{ backgroundColor: "#FFF7E6" }}>
                  <p className="font-semibold mb-2" style={{ color: "#B45309" }}>
                    施設未確定（{preview.unmatched.length}件）
                  </p>
                  <ul className="ml-2 space-y-1 text-sm">
                    {preview.unmatched.map((u) => (
                      <li key={u.statementLineId} className="flex justify-between">
                        <span>被保険者番号: {u.insuranceNumber || "(空)"}</span>
                        <span>
                          {yen(u.amount)} <StatusBadge status={u.matchStatus} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm mb-2 text-right" style={{ color: "#DC2626" }}>
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              className="qolc-btn px-4 py-2 rounded border"
              style={{ borderColor: "var(--qolc-border)" }}
              onClick={reset}
            >
              別のファイルを選ぶ
            </button>
            <button
              className="qolc-btn px-4 py-2 rounded text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--qolc-primary)" }}
              disabled={matchedCount === 0}
              title={matchedCount === 0 ? "決済可能な明細がありません" : undefined}
              onClick={() => setConfirming(true)}
            >
              決済を実行（{matchedCount}名）
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--qolc-muted)" }}>
            バッチID: {preview.batchId.slice(0, 8)}…
          </p>
        </>
      )}

      {executing && (
        <Card>
          <CardContent className="py-8 flex justify-center">
            <LoadingSpinner size="lg" label="決済を実行中..." />
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>決済を実行しました</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <ResultStat label="対象" value={result.total} />
              <ResultStat label="完了" value={result.success} color="#1B5E20" />
              <ResultStat label="保留" value={result.pending} color="#B45309" />
              <ResultStat label="失敗" value={result.failed} color="#991B1B" />
            </div>
            {result.pending > 0 && (
              <p className="text-sm p-3 rounded mb-4" style={{ backgroundColor: "#FFF7E6", color: "#B45309" }}>
                保留分はカード未登録の入居者です。カード登録後に再処理されます。
              </p>
            )}
            <button
              className="qolc-btn px-4 py-2 rounded text-white"
              style={{ backgroundColor: "var(--qolc-primary)" }}
              onClick={reset}
            >
              続けてアップロード
            </button>
          </CardContent>
        </Card>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-3">アップロード履歴</h2>
        <UploadHistory refreshKey={historyKey} hideMerchant />
      </section>

      <ConfirmDialog
        open={confirming}
        title="決済を実行しますか？"
        description="マッチした入居者の明細に対して決済処理を行います。カード登録済みの入居者は与信・売上計上され、未登録の入居者は保留となります。"
        confirmLabel="実行する"
        cancelLabel="やめる"
        onConfirm={executePayment}
        onCancel={() => setConfirming(false)}
      />
    </PortalLayout>
  );
}

function ResultStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="border rounded-md p-3 text-center" style={{ borderColor: "var(--qolc-border)" }}>
      <div className="text-2xl font-bold" style={{ color: color ?? "var(--qolc-text)" }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--qolc-muted)" }}>
        {label}
      </div>
    </div>
  );
}
