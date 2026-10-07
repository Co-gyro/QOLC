"use client";

/**
 * 運営センター「お買い物の明細照合」：カード会社の明細 CSV を取り込み、iPhone の記録と突合する。
 * 施設をまたいで扱う（カードは下4桁で施設を特定）。開発指示書 09 の 15.2。
 */
import { useCallback, useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { FileUpload } from "@/components/shared/file-upload";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { StatementReviewView } from "@/components/wallet/statement-review";
import { jstDateTime } from "@/components/wallet/wallet-status";
import type { StatementReview } from "@/lib/wallet/review";

interface ImportRow {
  id: string;
  file_name: string;
  target_month: string | null;
  line_count: number;
  imported_at: string;
  reconciled_at: string | null;
}

/** API を呼び、data を返す（失敗は例外） */
async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error ?? "処理できませんでした");
  return json.data as T;
}

/** 明細照合の画面 */
export default function AdminWalletStatementsPage() {
  const [imports, setImports] = useState<ImportRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [review, setReview] = useState<StatementReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadImports = useCallback(async () => {
    const data = await call<{ imports: ImportRow[] }>("/api/wallet/statements");
    setImports(data.imports);
    return data.imports;
  }, []);

  const openReview = useCallback(async (id: string) => {
    setSelectedId(id);
    setReview(null);
    setReview(await call<StatementReview>(`/api/wallet/statements/${id}/review`));
  }, []);

  useEffect(() => {
    loadImports().catch((e: Error) => setError(e.message));
  }, [loadImports]);

  /** 処理中の表示とエラー処理をまとめる */
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理できませんでした");
    } finally {
      setBusy(false);
    }
  }

  /** CSV を取り込む */
  function upload(file: File) {
    void run(async () => {
      const form = new FormData();
      form.set("file", file);
      const data = await call<{ import: ImportRow }>("/api/wallet/statements/import", { method: "POST", body: form });
      await loadImports();
      await openReview(data.import.id);
    });
  }

  /** 突合を実行する */
  function reconcileNow(id: string) {
    void run(async () => {
      await call(`/api/wallet/statements/${id}/reconcile`, { method: "POST" });
      await loadImports();
      await openReview(id);
    });
  }

  const selected = imports?.find((i) => i.id === selectedId) ?? null;

  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "今日のUD", href: "/admin/today" }, { label: "お買い物の明細照合" }]} />
      <h1 className="mb-2 text-2xl font-bold">お買い物の明細照合</h1>
      <p className="mb-4 text-sm" style={{ color: "var(--qolc-muted)" }}>
        カード会社の明細 CSV を取り込み、iPhone で記録された支払いと照らし合わせます。カード番号は下4桁だけを保存します。
      </p>

      <FileUpload onFile={upload} accept=".csv,text/csv" label="明細 CSV を選択またはドロップ" helperText="カード会社の利用明細 CSV（UTF-8 / Shift-JIS、最大10MB・10,000行）" />
      {busy && <LoadingSpinner />}
      {error && <p className="my-3 text-sm" style={{ color: "#DC2626" }} role="alert">{error}</p>}

      <section className="my-6">
        <h2 className="mb-2 text-lg font-bold">取り込んだ明細</h2>
        {!imports ? <LoadingSpinner /> : imports.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>まだ取り込んだ明細はありません</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-white" style={{ borderColor: "var(--qolc-border)" }}>
            {imports.map((imp) => (
              <li key={imp.id} className="flex flex-wrap items-center justify-between gap-3 p-3" style={{ background: imp.id === selectedId ? "#F0F9F4" : undefined }}>
                <button className="text-left" style={{ minHeight: 44 }} onClick={() => void run(() => openReview(imp.id))}>
                  <span className="font-bold">{imp.file_name}</span>
                  <span className="ml-2 text-sm" style={{ color: "var(--qolc-muted)" }}>
                    請求月 {imp.target_month ?? "—"}・{imp.line_count}行・取込 {jstDateTime(imp.imported_at)}
                  </span>
                </button>
                {imp.reconciled_at ? (
                  <span className="text-sm" style={{ color: "#2F6B47" }}>突合済み（{jstDateTime(imp.reconciled_at)}）</span>
                ) : (
                  <button disabled={busy} onClick={() => reconcileNow(imp.id)} className="rounded px-5 font-bold text-white disabled:opacity-50" style={{ minHeight: 44, background: "#4C986A" }}>
                    突合する
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && review && (
        <section>
          <h2 className="mb-3 text-xl font-bold">{selected.file_name} の結果</h2>
          {selected.reconciled_at ? <StatementReviewView review={review} /> : (
            <p className="text-sm">取り込みました（{review.lines.length}行）。「突合する」を押すと、iPhone の記録と照らし合わせます。</p>
          )}
        </section>
      )}
    </PortalLayout>
  );
}
