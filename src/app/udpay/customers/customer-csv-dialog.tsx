"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { customerCsvTemplate, parseCustomerCsv, type CustomerCsvRow, type CustomerCsvWarning } from "@/lib/udpay/customer-csv";
import { DEMO_MERCHANT } from "@/lib/udpay/merchant-profile";
import { useUdpayPaths } from "../_components/use-udpay-paths";

/** 取込結果 */
interface ImportResult {
  created: number;
  skipped: string[];
  mailed: number;
  errors?: string[];
}

/**
 * 顧客のCSV一括登録ダイアログ。先行顧客のリスト（Excel→CSV）を読み、内容を確認してから登録する。
 * 登録と同時にカード登録のご案内メールを送ることもできる。
 */
export function CustomerCsvDialog() {
  const router = useRouter();
  const { api, mode } = useUdpayPaths();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CustomerCsvRow[]>([]);
  const [warnings, setWarnings] = useState<CustomerCsvWarning[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sendMail, setSendMail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setResult(null);
    setError(null);
    setFileName(file.name);
    const parsed = parseCustomerCsv(new Uint8Array(await file.arrayBuffer()), DEMO_MERCHANT.chargeDays);
    setRows(parsed.rows);
    setWarnings(parsed.warnings);
  }

  function downloadTemplate() {
    const blob = new Blob([customerCsvTemplate()], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "顧客一括登録_ひな形.csv";
    a.click();
  }

  async function runImport() {
    if (sendMail && !confirm(`${rows.length}件の顧客へ、カード登録のご案内メールを送ります。よろしいですか？`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "importCustomers", sendMail, customers: rows.map(({ line: _line, ...c }) => c) }),
      });
      const data: ImportResult & { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error ?? "登録に失敗しました");
        return;
      }
      setResult(data);
      setRows([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="up-btn secondary" onClick={() => setOpen(true)}>
        CSVで一括登録
      </button>
    );
  }

  return (
    <div className="up-card" style={{ width: "100%", marginTop: 12 }}>
      <h2>顧客のCSV一括登録</h2>
      <p className="up-muted">
        1行目に見出し（医院名・担当者名・メール・CC・決済日・郵便番号・住所・住所2・備考）を入れた CSV を選んでください。
        Excel で保存した CSV（Shift-JIS）でも読み込めます。決済日が空の行は標準の{DEMO_MERCHANT.chargeDays[0]}日になります。
      </p>
      <div className="up-actions" style={{ margin: "8px 0" }}>
        <input type="file" accept=".csv,text/csv" aria-label="顧客CSVファイル" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} style={{ width: "auto" }} />
        <button type="button" className="up-btn secondary small" onClick={downloadTemplate}>ひな形をダウンロード</button>
      </div>
      {error && <p className="up-error">{error}</p>}
      {result && (
        <p className="up-notice">
          登録しました: {result.created}件
          {result.mailed > 0 && `（カード登録のご案内メール ${result.mailed}件）`}
          {result.skipped.length > 0 && ` ／ 登録済みのためスキップ: ${result.skipped.join("、")}`}
          {result.errors?.length ? ` ／ エラー: ${result.errors.join("、")}` : ""}
        </p>
      )}
      {fileName && rows.length + warnings.length > 0 && (
        <>
          <p>{fileName}：{rows.length}件を読み込みました。</p>
          {warnings.length > 0 && (
            <ul className="up-error" style={{ listStyle: "disc", paddingLeft: 28 }}>
              {warnings.map((w) => (
                <li key={`${w.line}-${w.message}`}>{w.line}行目: {w.message}</li>
              ))}
            </ul>
          )}
          {rows.length > 0 && (
            <div className="up-table-wrap" style={{ maxHeight: 320, overflowY: "auto" }}>
              <table className="up-table">
                <thead>
                  <tr><th>医院名</th><th>担当者</th><th>宛先（To / CC）</th><th>決済日</th><th>住所</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line}>
                      <td>{r.name}</td>
                      <td>{r.contactName || "—"}</td>
                      <td>
                        {r.email}
                        {r.cc.length > 0 && <div className="up-muted">CC: {r.cc.join(", ")}</div>}
                      </td>
                      <td>毎月{r.anniversaryDay}日</td>
                      <td>{[r.postalCode && `〒${r.postalCode}`, r.address1, r.address2].filter(Boolean).join(" ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
        <input type="checkbox" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} style={{ width: 20 }} />
        登録と同時に、カード登録のご案内メールを送る{mode === "demo" ? "（デモのため実際には送信されません）" : ""}
      </label>
      <div className="up-actions">
        <button type="button" className="up-btn" disabled={busy || rows.length === 0} onClick={runImport}>
          {busy ? "登録中…" : `${rows.length}件を登録する`}
        </button>
        <button type="button" className="up-btn secondary" onClick={() => { setOpen(false); setRows([]); setWarnings([]); setFileName(null); setResult(null); }}>
          閉じる
        </button>
      </div>
    </div>
  );
}
