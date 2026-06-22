"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  aggregateFm,
  encodeShiftJis,
  parseSaisonCsv,
  readSaisonCsvText,
  renderFmCsv,
  type FmPerClosingFile,
  type SaisonSalesRow,
} from "@/lib/csv/saison-fm";
import { parseSaisonPdfFromFile, type SaisonPdfData } from "@/lib/pdf/saison-pdf";
import { crossPdfCsvToFi, renderFiCsvBytes, type FiFile } from "@/lib/csv/saison-fi";
import { buildCsvFilename, isValidSaisonPayeeNumber } from "@/lib/csv/naming";

interface CsvEntry {
  id: string;
  file: File;
  rows: SaisonSalesRow[] | null;
  error: string | null;
  loading: boolean;
}
interface PdfEntry {
  id: string;
  file: File;
  data: SaisonPdfData | null;
  error: string | null;
  loading: boolean;
}
/** 生成された1つの出力ファイル（種別・ファイル名・内容）。
 *  UR は原本を無加工リネームするため srcFile を保持し bytes は使わない。 */
interface OutputFile {
  kind: "UR" | "FM" | "FI";
  filename: string;
  bytes: Uint8Array<ArrayBuffer>;
  note: string;
  srcFile?: File;
}

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function numberFormat(n: number) {
  return n.toLocaleString("en-US");
}
function dropClass(isDragging: boolean) {
  return cn(
    "flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/50",
  );
}
/** rows の中で最も多い締年月日(yyyymmdd)を返す（URファイル名用）。 */
function dominantClosing(rows: SaisonSalesRow[]): string {
  const count = new Map<string, number>();
  for (const r of rows) count.set(r.締年月日, (count.get(r.締年月日) ?? 0) + 1);
  let best = "";
  let bestN = -1;
  for (const [k, n] of Array.from(count.entries())) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

export function SaisonUnifiedTool() {
  const [csvEntries, setCsvEntries] = useState<CsvEntry[]>([]);
  const [pdfEntries, setPdfEntries] = useState<PdfEntry[]>([]);
  const [payeeNumber, setPayeeNumber] = useState("");
  const [transferDate, setTransferDate] = useState(""); // yyyy-mm-dd
  const [feeRate, setFeeRate] = useState(""); // %
  const [outputs, setOutputs] = useState<OutputFile[] | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [isCsvDragging, setIsCsvDragging] = useState(false);
  const [isPdfDragging, setIsPdfDragging] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const addCsv = useCallback((files: File[]) => {
    const accepted = files.filter((f) => /\.csv$/i.test(f.name));
    if (accepted.length === 0) return;
    const next: CsvEntry[] = accepted.map((file) => ({ id: createId(), file, rows: null, error: null, loading: true }));
    setCsvEntries((prev) => [...prev, ...next]);
    for (const entry of next) {
      (async () => {
        try {
          const rows = parseSaisonCsv(await readSaisonCsvText(entry.file));
          setCsvEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, rows, loading: false } : e)));
        } catch (err) {
          setCsvEntries((prev) =>
            prev.map((e) => (e.id === entry.id ? { ...e, loading: false, error: err instanceof Error ? err.message : "読込失敗" } : e)),
          );
        }
      })();
    }
  }, []);

  const addPdfs = useCallback((files: File[]) => {
    const accepted = files.filter((f) => /\.pdf$/i.test(f.name));
    if (accepted.length === 0) return;
    const next: PdfEntry[] = accepted.map((file) => ({ id: createId(), file, data: null, error: null, loading: true }));
    setPdfEntries((prev) => [...prev, ...next]);
    for (const entry of next) {
      (async () => {
        try {
          const data = await parseSaisonPdfFromFile(entry.file);
          setPdfEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, data, loading: false } : e)));
        } catch (err) {
          setPdfEntries((prev) =>
            prev.map((e) => (e.id === entry.id ? { ...e, loading: false, error: err instanceof Error ? err.message : "読込失敗" } : e)),
          );
        }
      })();
    }
  }, []);

  const csvRowsAll = useMemo(() => csvEntries.flatMap((e) => e.rows ?? []), [csvEntries]);
  const pdfDataAll = useMemo(
    () => pdfEntries.map((e) => e.data).filter((d): d is SaisonPdfData => d !== null),
    [pdfEntries],
  );

  // セゾンの支払先番号 = 売上データCSVの加盟店No.（最頻値）。手入力せず自動補完する。
  const csvMerchantNo = useMemo(() => {
    const nos = csvRowsAll.map((r) => r.加盟店No).filter(Boolean);
    if (nos.length === 0) return "";
    const count = new Map<string, number>();
    for (const n of nos) count.set(n, (count.get(n) ?? 0) + 1);
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }, [csvRowsAll]);

  // 加盟店No.を支払先番号に自動補完（空欄のときのみ。手入力は上書きしない）。
  useEffect(() => {
    if (csvMerchantNo && !payeeNumber) setPayeeNumber(csvMerchantNo);
  }, [csvMerchantNo, payeeNumber]);

  // PDFがあれば振込年月日・手数料率を自動補完（空欄のときのみ。手入力は上書きしない）。
  useEffect(() => {
    if (pdfDataAll.length === 0) return;
    if (!transferDate && pdfDataAll[0].transferDate) {
      setTransferDate(pdfDataAll[0].transferDate.replace(/\//g, "-"));
    }
    if (!feeRate) {
      const sumFee = pdfDataAll.reduce((s, p) => s + p.totalFee, 0);
      const sumAmt = pdfDataAll.reduce((s, p) => s + p.totalAmount, 0);
      if (sumAmt > 0) setFeeRate(String(Math.round((sumFee / sumAmt) * 100 * 100) / 100));
    }
  }, [pdfDataAll, transferDate, feeRate]);

  const loadingAny = csvEntries.some((e) => e.loading) || pdfEntries.some((e) => e.loading);
  const payeeOk = isValidSaisonPayeeNumber(payeeNumber);
  const canGenerate = payeeOk && csvRowsAll.length > 0 && !loadingAny;

  const handleGenerate = useCallback(() => {
    setGenError(null);
    const out: OutputFile[] = [];
    try {
      // UR: 各CSVを命名規則でリネーム（中身は無加工。原本ファイルを保持）
      for (const e of csvEntries) {
        if (!e.rows || e.rows.length === 0) continue;
        const closing = dominantClosing(e.rows);
        out.push({
          kind: "UR",
          filename: buildCsvFilename({ issuer: "SAISON", dataType: "UR", closingDate: closing, payeeNumber }),
          bytes: new Uint8Array(0),
          note: `${e.file.name}（${e.rows.length}行・原本リネーム）`,
          srcFile: e.file,
        });
      }

      // FM: 締日ごとに集計
      const rate = Number(feeRate);
      if (transferDate && Number.isFinite(rate) && feeRate !== "") {
        const fmFiles: FmPerClosingFile[] = aggregateFm(csvRowsAll, {
          transferDate: transferDate.replace(/-/g, "/"),
          payeeNumber,
          feeRatePercent: rate,
        });
        for (const f of fmFiles) {
          out.push({
            kind: "FM",
            filename: buildCsvFilename({ issuer: "SAISON", dataType: "FM", closingDate: f.closingYyyymmdd, payeeNumber }),
            bytes: encodeShiftJis(renderFmCsv(f)),
            note: `締日 ${f.closingYyyymmdd} / ${f.totals.件数}件 / 売上¥${numberFormat(f.totals.売上金額)} / 手数料¥${numberFormat(f.totals.手数料)}`,
          });
        }
      }

      // FI: PDFがあれば突合生成
      if (pdfDataAll.length > 0) {
        const fiFiles: FiFile[] = crossPdfCsvToFi(pdfDataAll, csvRowsAll, { payeeNumber });
        for (const f of fiFiles) {
          const empty = f.rows.length === 0;
          out.push({
            kind: "FI",
            filename: buildCsvFilename({ issuer: "SAISON", dataType: "FI", closingDate: f.closingYyyymmdd, payeeNumber }),
            bytes: renderFiCsvBytes(f),
            note: empty
              ? `⚠ ${f.merchantName || f.merchantStoreNo}: 締日/店舗Noで突合するCSV行なし`
              : `締日 ${f.pdf.closingDate} / 振込日 ${f.pdf.transferDate} / 手数料¥${numberFormat(f.pdf.totalFee)} / 振込¥${numberFormat(f.pdf.totalTransfer)}`,
          });
        }
      }

      if (out.length === 0) {
        setGenError("生成できる出力がありません。CSVと支払先番号を確認してください。");
        setOutputs(null);
        return;
      }
      setOutputs(out);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "生成に失敗しました。");
      setOutputs(null);
    }
  }, [csvEntries, csvRowsAll, pdfDataAll, payeeNumber, transferDate, feeRate]);

  const downloadOne = useCallback(async (o: OutputFile) => {
    const blob = o.srcFile ?? new Blob([o.bytes], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = o.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadZip = useCallback(async () => {
    if (!outputs || outputs.length === 0) return;
    setIsZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const used = new Map<string, number>();
      for (const o of outputs) {
        const data = o.srcFile ? new Uint8Array(await o.srcFile.arrayBuffer()) : o.bytes;
        const n = used.get(o.filename) ?? 0;
        used.set(o.filename, n + 1);
        const name = n === 0 ? o.filename : o.filename.replace(/\.csv$/i, `_(${n + 1}).csv`);
        zip.file(name, data);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SAISON_変換結果.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
    }
  }, [outputs]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      addCsv(files.filter((f) => /\.csv$/i.test(f.name)));
      addPdfs(files.filter((f) => /\.pdf$/i.test(f.name)));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addCsv, addPdfs]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>セゾン CSV変換（UR / FM / FI 一括）</CardTitle>
          <CardDescription>
            売上データCSVと支払計算書PDFを<span className="font-medium">1回アップロード</span>すると、
            セルフィッシュ用の <span className="font-medium">UR（リネーム）・FM（振込明細集計）・FI（振込情報）</span>
            をまとめて生成します。PDFがあれば<span className="font-medium">振込年月日・手数料率を自動補完</span>します。
            （Shift-JIS / CRLF）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="saison-payee">支払先番号（加盟店No.・CSVから自動）</Label>
              <Input
                id="saison-payee"
                inputMode="numeric"
                maxLength={10}
                placeholder="CSVから自動（例: 2077247）"
                value={payeeNumber}
                onChange={(e) => setPayeeNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
              {payeeNumber.length > 0 && !payeeOk ? (
                <p className="text-xs text-destructive">数字4〜10桁で入力してください。</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="saison-transfer">振込年月日（FM用 / PDFから自動）</Label>
              <Input id="saison-transfer" type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saison-fee">手数料率 %（FM用 / PDFから自動）</Label>
              <Input id="saison-fee" inputMode="decimal" placeholder="例: 2.59" value={feeRate} onChange={(e) => setFeeRate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>売上データCSV（複数可）</Label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsCsvDragging(true);
                }}
                onDragLeave={() => setIsCsvDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsCsvDragging(false);
                  addCsv(Array.from(e.dataTransfer.files));
                }}
                onClick={() => csvInputRef.current?.click()}
                className={dropClass(isCsvDragging)}
              >
                <p className="text-sm font-medium">CSVをドラッグ＆ドロップ</p>
                <p className="mt-1 text-xs text-muted-foreground">またはクリックして選択</p>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addCsv(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
              </div>
              {csvEntries.length > 0 ? (
                <ul className="divide-y rounded-md border text-sm">
                  {csvEntries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm" title={e.file.name}>{e.file.name}</p>
                        {e.loading ? (
                          <p className="text-xs text-muted-foreground">読込中…</p>
                        ) : e.error ? (
                          <p className="text-xs text-destructive">{e.error}</p>
                        ) : e.rows ? (
                          <p className="text-xs text-muted-foreground">{numberFormat(e.rows.length)}行</p>
                        ) : null}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setCsvEntries((prev) => prev.filter((x) => x.id !== e.id))}>
                        削除
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>支払計算書PDF（FI用・複数可・任意）</Label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsPdfDragging(true);
                }}
                onDragLeave={() => setIsPdfDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsPdfDragging(false);
                  addPdfs(Array.from(e.dataTransfer.files));
                }}
                onClick={() => pdfInputRef.current?.click()}
                className={dropClass(isPdfDragging)}
              >
                <p className="text-sm font-medium">PDFをドラッグ＆ドロップ</p>
                <p className="mt-1 text-xs text-muted-foreground">またはクリックして選択（任意）</p>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addPdfs(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
              </div>
              {pdfEntries.length > 0 ? (
                <ul className="divide-y rounded-md border text-sm">
                  {pdfEntries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm" title={e.file.name}>{e.file.name}</p>
                        {e.loading ? (
                          <p className="text-xs text-muted-foreground">PDF解析中…</p>
                        ) : e.error ? (
                          <p className="text-xs text-destructive">{e.error}</p>
                        ) : e.data ? (
                          <p className="text-xs text-muted-foreground">
                            締: {e.data.closingDate} / 振込: {e.data.transferDate} / 手数料: ¥{numberFormat(e.data.totalFee)}
                          </p>
                        ) : null}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setPdfEntries((prev) => prev.filter((x) => x.id !== e.id))}>
                        削除
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleGenerate} disabled={!canGenerate}>変換を生成</Button>
            {!canGenerate ? (
              <p className="text-xs text-muted-foreground">支払先番号（加盟店No.）と売上データCSVが必要です。FMは振込年月日・手数料率、FIはPDFも必要。</p>
            ) : null}
          </div>
          {genError ? <p className="text-sm text-destructive">{genError}</p> : null}
        </CardContent>
      </Card>

      {outputs && outputs.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">生成結果（{outputs.length}ファイル）</CardTitle>
              <CardDescription>UR / FM / FI をまとめて出力。個別 or ZIPでダウンロードできます。</CardDescription>
            </div>
            <Button onClick={downloadZip} disabled={isZipping}>{isZipping ? "ZIP作成中…" : "まとめてZIPダウンロード"}</Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {outputs.map((o, i) => (
                <li key={`${o.filename}_${i}`} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        o.kind === "UR" ? "bg-blue-100 text-blue-700" : o.kind === "FM" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700",
                      )}>{o.kind}</span>
                      <span className="truncate font-mono text-xs text-emerald-700" title={o.filename}>{o.filename}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{o.note}</p>
                  </div>
                  <Button size="sm" onClick={() => downloadOne(o)}>ダウンロード</Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
