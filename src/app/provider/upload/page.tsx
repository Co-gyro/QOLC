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
  const [batchId, setBatchId] = useState<string | null>(null);
  const [loadingSlot, setLoadingSlot] = useState<null | "main" | "other">(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  /** ①②共通: ファイルを現バッチへ取込む（未作成なら新規。サーバが種別自動判定） */
  async function handleUpload(file: File, slot: "main" | "other") {
    setError(null);
    setLoadingSlot(slot);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const q = batchId ? `?batchId=${batchId}` : "";
      const res = await fetch(`/api/upload${q}`, { method: "POST", body: fd });
      const json = (await res.json()) as ApiResponse<PreviewResult>;
      if (!json.success) {
        setError(json.error);
        return;
      }
      setBatchId(json.data.batchId);
      setPreview(json.data);
      setHistoryKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setLoadingSlot(null);
    }
  }

  function reset() {
    setBatchId(null);
    setPreview(null);
    setError(null);
    setResult(null);
  }

  async function executePayment() {
    if (!batchId) return;
    setConfirming(false);
    setExecuting(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadBatchId: batchId }),
      });
      const json = (await res.json()) as ApiResponse<ExecuteResult>;
      if (!json.success) {
        setError(json.error);
        setExecuting(false);
        return;
      }
      setResult(json.data);
      setHistoryKey((k) => k + 1);
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
      <h1 className="text-2xl font-bold mb-2">明細アップロード</h1>
      <p className="text-sm mb-6" style={{ color: "var(--qolc-muted)" }}>
        ①明細・②その他費用はどちらから入れてもOKです。1回の取込み（同じまとめ）に合算され、入居者ごとに1決済になります。
      </p>

      {!result && (
        <div className="grid gap-4 md:grid-cols-2 mb-4">
          {/* ① 明細・レセプト */}
          <UploadSlot
            badge="①"
            title="明細・レセプト"
            description="介護保険CSV／医療保険UKE（.xlsx）／独自CSV（被保険者番号＋金額）。保険分の費用総額・給付・本人負担を取込みます。"
            helperText="最大10MB。介護CSV・医療UKE・独自CSVに対応。"
            loading={loadingSlot === "main"}
            onFile={(f) => handleUpload(f, "main")}
          />
          {/* ② その他費用（保険外） */}
          <UploadSlot
            badge="②"
            title="その他費用（保険外）"
            description="家賃・食事・居住費・日常生活費などレセプトに載らない自費。被保険者番号で各入居者に合算します。列＝被保険者番号, その他費用（任意で 10%対象, 8%対象）。"
            helperText="その他費用CSV（被保険者番号＋合計のヘッダ付き）。単独・先行でもOK。"
            loading={loadingSlot === "other"}
            onFile={(f) => handleUpload(f, "other")}
            dashed
          />
        </div>
      )}

      {error && (
        <p className="text-sm mb-4" style={{ color: "#DC2626" }}>
          {error}
        </p>
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

          <div className="flex gap-2 justify-end">
            <button
              className="qolc-btn px-4 py-2 rounded border"
              style={{ borderColor: "var(--qolc-border)" }}
              onClick={reset}
            >
              新しいまとめを始める
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
            まとめID: {preview.batchId.slice(0, 8)}…（追加で①②を投入すると同じまとめに合算されます）
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

/** 1つのアップロード枠（明細 / その他費用） */
function UploadSlot({
  badge,
  title,
  description,
  helperText,
  loading,
  onFile,
  dashed = false,
}: {
  badge: string;
  title: string;
  description: string;
  helperText: string;
  loading: boolean;
  onFile: (file: File) => void;
  dashed?: boolean;
}) {
  return (
    <Card style={dashed ? { borderColor: "var(--qolc-border)", borderStyle: "dashed" } : undefined}>
      <CardHeader>
        <CardTitle className="text-base">
          <span className="mr-2" style={{ color: "var(--qolc-primary)" }}>{badge}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-3" style={{ color: "var(--qolc-muted)" }}>{description}</p>
        {loading ? (
          <div className="py-4 flex justify-center">
            <LoadingSpinner size="md" label="取込み中..." />
          </div>
        ) : (
          <FileUpload onFile={onFile} helperText={helperText} />
        )}
      </CardContent>
    </Card>
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
