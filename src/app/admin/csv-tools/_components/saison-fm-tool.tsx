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
import {
  buildCsvFilename,
  isValidPayeeNumber,
} from "@/lib/csv/naming";

interface FileEntry {
  id: string;
  file: File;
  rows: SaisonSalesRow[] | null;
  error: string | null;
  loading: boolean;
}

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isValidTransferDate(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

function isoToSlashed(iso: string) {
  return iso.replace(/-/g, "/");
}

function numberFormat(n: number) {
  return n.toLocaleString("en-US");
}

export function SaisonFmTool() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [transferDate, setTransferDate] = useState("");
  const [payeeNumber, setPayeeNumber] = useState("");
  const [feeRateText, setFeeRateText] = useState("3.25");
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const feeRatePercent = useMemo(() => {
    const n = Number(feeRateText);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }, [feeRateText]);

  const addFiles = useCallback((files: File[]) => {
    const accepted = files.filter((f) => /\.csv$/i.test(f.name));
    if (accepted.length === 0) return;

    const newEntries: FileEntry[] = accepted.map((file) => ({
      id: createId(),
      file,
      rows: null,
      error: null,
      loading: true,
    }));
    setEntries((prev) => [...prev, ...newEntries]);

    newEntries.forEach((entry) => {
      (async () => {
        try {
          const text = await readSaisonCsvText(entry.file);
          const rows = parseSaisonCsv(text);
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id ? { ...e, rows, loading: false } : e,
            ),
          );
        } catch (err) {
          setEntries((prev) =>
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
    });
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      addFiles(files);
      e.target.value = "";
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      addFiles(files);
    },
    [addFiles],
  );

  const handleRemove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleClear = useCallback(() => setEntries([]), []);

  const allRows = useMemo(
    () => entries.flatMap((e) => e.rows ?? []),
    [entries],
  );

  const inputsValid =
    isValidTransferDate(transferDate) &&
    isValidPayeeNumber(payeeNumber) &&
    Number.isFinite(feeRatePercent) &&
    feeRatePercent >= 0;

  const aggregatedFiles = useMemo<FmPerClosingFile[]>(() => {
    if (!inputsValid || allRows.length === 0) return [];
    return aggregateFm(allRows, {
      transferDate: isoToSlashed(transferDate),
      payeeNumber,
      feeRatePercent,
    });
  }, [inputsValid, allRows, transferDate, payeeNumber, feeRatePercent]);

  const downloadFmFile = useCallback(
    (f: FmPerClosingFile) => {
      const csv = renderFmCsv(f);
      const bytes = encodeShiftJis(csv);
      const blob = new Blob([bytes], { type: "text/csv" });
      const filename = buildCsvFilename({
        issuer: "SAISON",
        dataType: "FM",
        closingDate: f.closingYyyymmdd,
        payeeNumber,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [payeeNumber],
  );

  const handleDownloadZip = useCallback(async () => {
    if (aggregatedFiles.length === 0) return;

    setIsZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const f of aggregatedFiles) {
        const filename = buildCsvFilename({
          issuer: "SAISON",
          dataType: "FM",
          closingDate: f.closingYyyymmdd,
          payeeNumber,
        });
        const csv = renderFmCsv(f);
        const bytes = encodeShiftJis(csv);
        zip.file(filename, bytes);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const earliest = aggregatedFiles
        .map((f) => f.closingYyyymmdd)
        .sort()[0];
      const zipName = `SAISON_FM_${earliest}.zip`;
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
  }, [aggregatedFiles, payeeNumber]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length > 0) addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>セゾン 振込明細 (FM) 集計</CardTitle>
          <CardDescription>
            NetアンサーforBizからダウンロードした売上データCSVを読み込み、
            加盟店ごとに集計して振込明細CSV (Shift-JIS / CRLF) を生成します。
            締日が混在している場合は締日ごとに別ファイルで出力します。
            端数処理は<span className="font-medium">切り捨て (Math.floor)</span>。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="saison-fm-transfer-date">振込年月日</Label>
              <Input
                id="saison-fm-transfer-date"
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saison-fm-payee-number">支払先番号（9桁）</Label>
              <Input
                id="saison-fm-payee-number"
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
            <div className="space-y-2">
              <Label htmlFor="saison-fm-fee-rate">手数料率 (%)</Label>
              <Input
                id="saison-fm-fee-rate"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="例: 3.25"
                value={feeRateText}
                onChange={(e) => setFeeRateText(e.target.value)}
              />
              {feeRateText.length > 0 && !Number.isFinite(feeRatePercent) ? (
                <p className="text-xs text-destructive">数値で入力してください。</p>
              ) : null}
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/50",
            )}
          >
            <p className="text-sm font-medium">売上データCSVをドラッグ＆ドロップ</p>
            <p className="mt-1 text-xs text-muted-foreground">
              またはクリックしてファイルを選択（複数可、全ファイルのデータを結合して集計）
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </CardContent>
      </Card>

      {entries.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">入力ファイル ({entries.length})</CardTitle>
              <CardDescription>
                読込み済みデータ行: {numberFormat(allRows.length)}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleClear}>
              クリア
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium" title={entry.file.name}>
                        {entry.file.name}
                      </span>
                      {entry.rows ? (
                        <span className="text-xs text-muted-foreground">
                          {numberFormat(entry.rows.length)}行
                        </span>
                      ) : null}
                    </div>
                    {entry.loading ? (
                      <p className="text-xs text-muted-foreground">読込中…</p>
                    ) : null}
                    {entry.error ? (
                      <p className="text-xs text-destructive">{entry.error}</p>
                    ) : null}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(entry.id)}>
                    削除
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {aggregatedFiles.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">
                集計結果 ({aggregatedFiles.length}ファイル)
              </CardTitle>
              <CardDescription>
                締日ごとに1ファイル。Shift-JIS / CRLF で出力します。
              </CardDescription>
            </div>
            <Button
              onClick={handleDownloadZip}
              disabled={!inputsValid || isZipping}
            >
              {isZipping ? "ZIP作成中…" : "まとめてZIPダウンロード"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {aggregatedFiles.map((f) => {
              const filename = buildCsvFilename({
                issuer: "SAISON",
                dataType: "FM",
                closingDate: f.closingYyyymmdd,
                payeeNumber,
              });
              return (
                <section key={f.closingYyyymmdd} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm text-emerald-700">→ {filename}</p>
                      <p className="text-xs text-muted-foreground">
                        加盟店: {f.rows.length} / 件数: {numberFormat(f.totals.件数)} /
                        売上: ¥{numberFormat(f.totals.売上金額)} /
                        手数料: ¥{numberFormat(f.totals.手数料)} /
                        振込: ¥{numberFormat(f.totals.振込金額)}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => downloadFmFile(f)} disabled={!inputsValid}>
                      ダウンロード
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">締日</th>
                          <th className="px-3 py-2 text-left font-medium">加盟店名</th>
                          <th className="px-3 py-2 text-right font-medium">件数</th>
                          <th className="px-3 py-2 text-right font-medium">売上金額</th>
                          <th className="px-3 py-2 text-right font-medium">手数料率</th>
                          <th className="px-3 py-2 text-right font-medium">手数料</th>
                          <th className="px-3 py-2 text-right font-medium">振込金額</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {f.rows.map((r) => (
                          <tr key={r.加盟店名}>
                            <td className="px-3 py-2">{r.締日}</td>
                            <td className="px-3 py-2">{r.加盟店名}</td>
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
                </section>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
