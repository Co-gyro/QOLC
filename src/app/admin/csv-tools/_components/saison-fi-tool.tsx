"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  parseSaisonCsv,
  readSaisonCsvText,
  type SaisonSalesRow,
} from "@/lib/csv/saison-fm";
import { parseSaisonPdfFromFile } from "@/lib/pdf/saison-pdf";
import type { SaisonPdfData } from "@/lib/pdf/saison-pdf";
import {
  crossPdfCsvToFi,
  renderFiCsvBytes,
  type FiFile,
} from "@/lib/csv/saison-fi";
import { buildCsvFilename, isValidPayeeNumber } from "@/lib/csv/naming";

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

export function SaisonFiTool() {
  const [csvEntries, setCsvEntries] = useState<CsvEntry[]>([]);
  const [pdfEntries, setPdfEntries] = useState<PdfEntry[]>([]);
  const [payeeNumber, setPayeeNumber] = useState("");
  const [isCsvDragging, setIsCsvDragging] = useState(false);
  const [isPdfDragging, setIsPdfDragging] = useState(false);
  const [generated, setGenerated] = useState<FiFile[] | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const addCsv = useCallback((files: File[]) => {
    const accepted = files.filter((f) => /\.csv$/i.test(f.name));
    if (accepted.length === 0) return;
    const next: CsvEntry[] = accepted.map((file) => ({
      id: createId(),
      file,
      rows: null,
      error: null,
      loading: true,
    }));
    setCsvEntries((prev) => [...prev, ...next]);
    for (const entry of next) {
      (async () => {
        try {
          const text = await readSaisonCsvText(entry.file);
          const rows = parseSaisonCsv(text);
          setCsvEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id ? { ...e, rows, loading: false } : e,
            ),
          );
        } catch (err) {
          setCsvEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id
                ? {
                    ...e,
                    loading: false,
                    error: err instanceof Error ? err.message : "読み込み失敗",
                  }
                : e,
            ),
          );
        }
      })();
    }
  }, []);

  const addPdfs = useCallback((files: File[]) => {
    const accepted = files.filter((f) => /\.pdf$/i.test(f.name));
    if (accepted.length === 0) return;
    const next: PdfEntry[] = accepted.map((file) => ({
      id: createId(),
      file,
      data: null,
      error: null,
      loading: true,
    }));
    setPdfEntries((prev) => [...prev, ...next]);
    for (const entry of next) {
      (async () => {
        try {
          const data = await parseSaisonPdfFromFile(entry.file);
          setPdfEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id ? { ...e, data, loading: false } : e,
            ),
          );
        } catch (err) {
          setPdfEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id
                ? {
                    ...e,
                    loading: false,
                    error: err instanceof Error ? err.message : "読み込み失敗",
                  }
                : e,
            ),
          );
        }
      })();
    }
  }, []);

  const csvRowsAll = useMemo(
    () => csvEntries.flatMap((e) => e.rows ?? []),
    [csvEntries],
  );
  const pdfDataAll = useMemo(
    () => pdfEntries.map((e) => e.data).filter((d): d is SaisonPdfData => d !== null),
    [pdfEntries],
  );

  const canGenerate =
    isValidPayeeNumber(payeeNumber) &&
    csvRowsAll.length > 0 &&
    pdfDataAll.length > 0 &&
    csvEntries.every((e) => !e.loading) &&
    pdfEntries.every((e) => !e.loading);

  const handleGenerate = useCallback(() => {
    setGenerateError(null);
    try {
      const files = crossPdfCsvToFi(pdfDataAll, csvRowsAll, { payeeNumber });
      setGenerated(files);
      const emptyOnes = files.filter((f) => f.rows.length === 0);
      if (emptyOnes.length > 0) {
        const names = emptyOnes.map((f) => f.merchantName || f.merchantStoreNo).join(", ");
        setGenerateError(`PDFに対応するCSV行が見つかりませんでした（${names}）。`);
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "生成に失敗しました。");
    }
  }, [pdfDataAll, csvRowsAll, payeeNumber]);

  const filenameFor = useCallback(
    (f: FiFile, allFiles: FiFile[]) => {
      const base = buildCsvFilename({
        issuer: "SAISON",
        dataType: "FI",
        closingDate: f.closingYyyymmdd,
        payeeNumber,
      });
      const sameClosing = allFiles.filter((x) => x.closingYyyymmdd === f.closingYyyymmdd);
      if (sameClosing.length <= 1) return base;
      return base.replace(/\.csv$/i, `_${f.merchantStoreNo}.csv`);
    },
    [payeeNumber],
  );

  const downloadOne = useCallback(
    (f: FiFile) => {
      if (!generated) return;
      const bytes = renderFiCsvBytes(f);
      const blob = new Blob([bytes], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFor(f, generated);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [generated, filenameFor],
  );

  const downloadZip = useCallback(async () => {
    if (!generated || generated.length === 0) return;
    setIsZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const f of generated) {
        zip.file(filenameFor(f, generated), renderFiCsvBytes(f));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const earliest = generated
        .map((f) => f.closingYyyymmdd)
        .sort()[0];
      const zipName = `SAISON_FI_${earliest}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
    }
  }, [generated, filenameFor]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      const csvs = files.filter((f) => /\.csv$/i.test(f.name));
      const pdfs = files.filter((f) => /\.pdf$/i.test(f.name));
      if (csvs.length > 0) addCsv(csvs);
      if (pdfs.length > 0) addPdfs(pdfs);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addCsv, addPdfs]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>セゾン 振込情報 (FI) 生成</CardTitle>
          <CardDescription>
            売上データCSVと支払計算書PDFをクロス集計し、FI形式のCSVを生成します。
            PDFから振込日・手数料・差引金額を、CSVから支払方法別の件数・売上金額を取得し、
            手数料率は<span className="font-medium">PDF手数料 ÷ CSV売上金額</span>で逆算します。
            端数処理は<span className="font-medium">四捨五入 (Math.round)</span>。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:max-w-md">
            <div className="space-y-2">
              <Label htmlFor="saison-fi-payee-number">支払先番号（9桁）</Label>
              <Input
                id="saison-fi-payee-number"
                type="text"
                inputMode="numeric"
                maxLength={9}
                placeholder="例: 156742401"
                value={payeeNumber}
                onChange={(e) =>
                  setPayeeNumber(e.target.value.replace(/\D/g, "").slice(0, 9))
                }
              />
              {payeeNumber.length > 0 && !isValidPayeeNumber(payeeNumber) ? (
                <p className="text-xs text-destructive">9桁の数字で入力してください。</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>売上データCSV</Label>
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
                <p className="mt-1 text-xs text-muted-foreground">
                  またはクリックして選択
                </p>
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
                          <p className="text-xs text-muted-foreground">
                            {numberFormat(e.rows.length)}行
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setCsvEntries((prev) => prev.filter((x) => x.id !== e.id))
                        }
                      >
                        削除
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>支払計算書PDF（複数可）</Label>
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
                <p className="mt-1 text-xs text-muted-foreground">
                  またはクリックして選択（複数可）
                </p>
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
                            {e.data.merchantName} / 締: {e.data.closingDate} / 振込:{" "}
                            {e.data.transferDate} / 手数料: ¥{numberFormat(e.data.totalFee)} /
                            差引: ¥{numberFormat(e.data.totalTransfer)}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPdfEntries((prev) => prev.filter((x) => x.id !== e.id))
                        }
                      >
                        削除
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleGenerate} disabled={!canGenerate}>
              生成
            </Button>
            {!canGenerate ? (
              <p className="text-xs text-muted-foreground">
                支払先番号・CSV・PDFをすべて入力してください。
              </p>
            ) : null}
          </div>
          {generateError ? (
            <p className="text-sm text-destructive">{generateError}</p>
          ) : null}
        </CardContent>
      </Card>

      {generated && generated.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">生成結果 ({generated.length}ファイル)</CardTitle>
              <CardDescription>
                PDF読取値とCSV集計値を突合し、FIフォーマットで出力します。
              </CardDescription>
            </div>
            <Button onClick={downloadZip} disabled={isZipping}>
              {isZipping ? "ZIP作成中…" : "まとめてZIPダウンロード"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-8">
            {generated.map((f) => {
              const name = filenameFor(f, generated);
              const feeDiffAbs = Math.abs(f.feeDifference);
              const transferDiffAbs = Math.abs(f.transferDifference);
              return (
                <section key={`${f.closingYyyymmdd}_${f.merchantStoreNo}`} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm text-emerald-700">→ {name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.merchantName || "(加盟店名未取得)"} / 加盟店店舗No.:{" "}
                        {f.merchantStoreNo} / 締日: {f.pdf.closingDate} / 振込日:{" "}
                        {f.pdf.transferDate}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => downloadOne(f)}>
                      ダウンロード
                    </Button>
                  </div>

                  <div className="grid gap-2 rounded-md bg-muted/50 p-3 text-xs md:grid-cols-2">
                    <div>
                      <p className="font-medium text-muted-foreground">PDF読取値</p>
                      <p className="font-mono">
                        手数料 ¥{numberFormat(f.pdf.totalFee)} / 差引 ¥
                        {numberFormat(f.pdf.totalTransfer)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">CSV集計値 (逆算率適用後)</p>
                      <p className="font-mono">
                        売上 ¥{numberFormat(f.totals.売上金額)} / 手数料 ¥
                        {numberFormat(f.totals.手数料)} / 振込 ¥
                        {numberFormat(f.totals.振込金額)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">逆算手数料率</p>
                      <p className="font-mono">
                        {f.ratePercent.toFixed(4)}% (表示: {f.rateDisplay}%)
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">差異チェック</p>
                      <p
                        className={cn(
                          "font-mono",
                          feeDiffAbs <= 1 && transferDiffAbs <= 1
                            ? "text-emerald-700"
                            : "text-destructive",
                        )}
                      >
                        手数料差: ¥{f.feeDifference} / 振込差: ¥{f.transferDifference}
                        {feeDiffAbs <= 1 && transferDiffAbs <= 1 ? " ✓" : " ⚠"}
                      </p>
                    </div>
                  </div>

                  {f.rows.length === 0 ? (
                    <p className="text-sm text-destructive">
                      該当するCSV行がありません（加盟店店舗No.と締日で突合失敗）。
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">支払区分</th>
                            <th className="px-3 py-2 text-right font-medium">件数</th>
                            <th className="px-3 py-2 text-right font-medium">売上金額</th>
                            <th className="px-3 py-2 text-right font-medium">手数料率</th>
                            <th className="px-3 py-2 text-right font-medium">手数料</th>
                            <th className="px-3 py-2 text-right font-medium">振込金額</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {f.rows.map((r) => (
                            <tr key={r.支払区分}>
                              <td className="px-3 py-2">{r.支払区分}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.売上件数}</td>
                              <td className="px-3 py-2 text-right font-mono">
                                ¥{numberFormat(r.売上金額)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">{r.手数料率}%</td>
                              <td className="px-3 py-2 text-right font-mono">
                                ¥{numberFormat(r.手数料)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                ¥{numberFormat(r.振込金額)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
