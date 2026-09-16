"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildTemplateCsv,
  parseUdpayInvoiceCsv,
  type CsvImportRow,
  type CsvImportWarning,
} from "@/lib/udpay/csv-import";

/** 取込結果（APIレスポンス） */
interface ImportResult {
  ok: boolean;
  created: number;
  updated: number;
  skippedConfirmed: string[];
  unmatched: { line: number; key: string; reason: string }[];
  error?: string;
}

/**
 * 請求のCSV一括取込ダイアログ。
 * 既存の請求管理（Excel等）からの移行用: 顧客名/摘要/数量/単価のCSVを読み込み、
 * 顧客ごとの下書き請求書を一括作成・更新する（確定済みは変更しない）。
 */
export function CsvImportDialog({
  month,
  customerNames,
}: {
  month: string;
  customerNames: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvImportRow[]>([]);
  const [warnings, setWarnings] = useState<CsvImportWarning[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setRows([]);
    setWarnings([]);
    setFileName(null);
    setResult(null);
  }

  async function handleFile(file: File) {
    reset();
    setFileName(file.name);
    const buf = new Uint8Array(await file.arrayBuffer());
    const parsed = parseUdpayInvoiceCsv(buf);
    setRows(parsed.rows);
    setWarnings(parsed.warnings);
  }

  async function runImport() {
    setBusy(true);
    try {
      const res = await fetch("/api/udpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "importInvoiceCsv", month, rows }),
      });
      const data: ImportResult = await res.json();
      setResult(data);
      if (data.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([buildTemplateCsv(customerNames.map((name) => ({ name })))], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "請求取込テンプレート.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) {
    return (
      <button type="button" className="up-btn secondary" onClick={() => setOpen(true)}>
        CSVで一括作成
      </button>
    );
  }

  const customerCount = new Set(rows.map((r) => r.email ?? r.name)).size;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 50, background: "rgba(22,35,62,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        className="up-card"
        style={{ maxWidth: 640, width: "100%", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>請求データのCSV一括取込（{month}月分）</h2>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          列: <strong>顧客名, 摘要, 数量, 単価（税抜）</strong>（顧客メール列があればメールで特定）。
          Excelで作成したCSV（Shift-JIS/UTF-8どちらでも）を読み込めます。
          顧客ごとに下書き請求書を作成・更新します（確定済みの請求書は変更しません）。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button type="button" className="up-btn secondary small" onClick={downloadTemplate}>
            テンプレートCSVをダウンロード
          </button>
          <label className="up-btn secondary small" style={{ cursor: "pointer" }}>
            CSVファイルを選択
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {fileName && (
          <div className="up-notice">
            {fileName}: 明細{rows.length}行／顧客{customerCount}件を読み込みました
          </div>
        )}
        {warnings.length > 0 && (
          <div className="up-error">
            {warnings.slice(0, 8).map((w) => (
              <div key={`${w.line}-${w.message}`}>
                {w.line}行目: {w.message}
              </div>
            ))}
            {warnings.length > 8 && <div>ほか{warnings.length - 8}件の警告</div>}
          </div>
        )}

        {result && (
          <div className={result.ok ? "up-notice" : "up-error"}>
            {result.ok ? (
              <>
                取込完了: 下書き作成 {result.created}件／更新 {result.updated}件
                {result.skippedConfirmed.length > 0 && (
                  <div>確定済みのためスキップ: {result.skippedConfirmed.join("、")}</div>
                )}
                {result.unmatched.length > 0 && (
                  <div style={{ color: "var(--red)" }}>
                    顧客を特定できなかった行:
                    {result.unmatched.slice(0, 8).map((u) => (
                      <div key={`${u.line}-${u.key}`}>
                        {u.line}行目「{u.key}」— {u.reason}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>取込に失敗しました: {result.error ?? "入力を確認してください"}</>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" className="up-btn secondary" onClick={() => setOpen(false)}>
            閉じる
          </button>
          <button
            type="button"
            className="up-btn"
            disabled={busy || rows.length === 0}
            onClick={() => void runImport()}
          >
            {busy ? "取込中…" : `取込を実行（${rows.length}行）`}
          </button>
        </div>
      </div>
    </div>
  );
}
