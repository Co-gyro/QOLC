"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  detectJcbFromFile,
  type JcbDetectionResult,
} from "@/lib/csv/jcb-rename";
import {
  buildCsvFilename,
  formatClosingDate,
  isValidClosingDate,
  isValidPayeeNumber,
  type DataType,
} from "@/lib/csv/naming";

interface FileEntry {
  id: string;
  file: File;
  detection: JcbDetectionResult | null;
  error: string | null;
  loading: boolean;
}

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function dataTypeBadgeClass(type: DataType | null | undefined) {
  switch (type) {
    case "UR":
      return "bg-blue-100 text-blue-700";
    case "FI":
      return "bg-green-100 text-green-700";
    case "FM":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function dataTypeLabel(type: DataType | null | undefined) {
  switch (type) {
    case "UR":
      return "売上明細 (UR)";
    case "FI":
      return "振込情報 (FI)";
    case "FM":
      return "振込明細 (FM)";
    default:
      return "判別不可";
  }
}

export function JcbRenameTool() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [closingDate, setClosingDate] = useState("");
  const [payeeNumber, setPayeeNumber] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: File[]) => {
    const accepted = files.filter((f) => /\.csv$/i.test(f.name));
    if (accepted.length === 0) return;

    const newEntries: FileEntry[] = accepted.map((file) => ({
      id: createId(),
      file,
      detection: null,
      error: null,
      loading: true,
    }));

    setEntries((prev) => [...prev, ...newEntries]);

    newEntries.forEach((entry) => {
      detectJcbFromFile(entry.file)
        .then((result) => {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id
                ? { ...e, detection: result, loading: false }
                : e,
            ),
          );
        })
        .catch((err: unknown) => {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id
                ? {
                    ...e,
                    loading: false,
                    error:
                      err instanceof Error ? err.message : "読み込み失敗",
                  }
                : e,
            ),
          );
        });
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

  const handleClear = useCallback(() => {
    setEntries([]);
  }, []);

  const canDownload = useMemo(
    () =>
      isValidClosingDate(closingDate) &&
      isValidPayeeNumber(payeeNumber) &&
      entries.some((e) => e.detection?.dataType),
    [closingDate, payeeNumber, entries],
  );

  const handleDownload = useCallback(
    async (entry: FileEntry) => {
      if (!entry.detection?.dataType) return;
      if (!isValidClosingDate(closingDate) || !isValidPayeeNumber(payeeNumber)) return;

      const filename = buildCsvFilename({
        issuer: "JCB",
        dataType: entry.detection.dataType,
        closingDate,
        payeeNumber,
      });

      const url = URL.createObjectURL(entry.file);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [closingDate, payeeNumber],
  );

  const handleDownloadAll = useCallback(async () => {
    for (const entry of entries) {
      if (!entry.detection?.dataType) continue;
      await handleDownload(entry);
      await new Promise((r) => setTimeout(r, 150));
    }
  }, [entries, handleDownload]);

  const [isZipping, setIsZipping] = useState(false);

  const handleDownloadZip = useCallback(async () => {
    if (!isValidClosingDate(closingDate) || !isValidPayeeNumber(payeeNumber)) return;
    const targets = entries.filter((e) => e.detection?.dataType);
    if (targets.length === 0) return;

    setIsZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const usedNames = new Map<string, number>();

      for (const entry of targets) {
        const dataType = entry.detection!.dataType!;
        const baseName = buildCsvFilename({
          issuer: "JCB",
          dataType,
          closingDate,
          payeeNumber,
        });
        const seen = usedNames.get(baseName) ?? 0;
        usedNames.set(baseName, seen + 1);
        const finalName =
          seen === 0 ? baseName : baseName.replace(/\.csv$/i, `_(${seen + 1}).csv`);
        const buffer = await entry.file.arrayBuffer();
        zip.file(finalName, buffer);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const zipName = `JCB_${formatClosingDate(closingDate)}.zip`;
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
  }, [entries, closingDate, payeeNumber]);

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
          <CardTitle>JCB CSVリネーム</CardTitle>
          <CardDescription>
            JCB Linkからダウンロードした振込情報・振込明細・売上明細のCSVを、
            セルフィッシュ命名規則 (JCB_種別_締日_支払先番号.csv) にリネームします。
            CSVの中身・文字コード (Shift-JIS) は一切変更しません。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="closing-date">締日</Label>
              <Input
                id="closing-date"
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payee-number">支払先番号（9桁）</Label>
              <Input
                id="payee-number"
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
            <p className="text-sm font-medium">CSVファイルをドラッグ＆ドロップ</p>
            <p className="mt-1 text-xs text-muted-foreground">
              またはクリックしてファイルを選択（複数可）
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
              <CardTitle className="text-xl">ファイル一覧 ({entries.length})</CardTitle>
              <CardDescription>
                データ種別はヘッダー列から自動判別しています。
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleClear}>
                クリア
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadAll}
                disabled={!canDownload || isZipping}
              >
                全て個別ダウンロード
              </Button>
              <Button
                onClick={handleDownloadZip}
                disabled={!canDownload || isZipping}
              >
                {isZipping ? "ZIP作成中…" : "まとめてZIPダウンロード"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {entries.map((entry) => {
                const dataType = entry.detection?.dataType ?? null;
                const newName = dataType && isValidClosingDate(closingDate) && isValidPayeeNumber(payeeNumber)
                  ? buildCsvFilename({
                      issuer: "JCB",
                      dataType,
                      closingDate,
                      payeeNumber,
                    })
                  : null;

                return (
                  <li key={entry.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            dataTypeBadgeClass(dataType),
                          )}
                        >
                          {entry.loading ? "判別中…" : dataTypeLabel(dataType)}
                        </span>
                        <span className="truncate text-sm font-medium" title={entry.file.name}>
                          {entry.file.name}
                        </span>
                        {entry.detection ? (
                          <span className="text-xs text-muted-foreground">
                            {entry.detection.columnCount}列
                          </span>
                        ) : null}
                      </div>
                      {entry.detection?.reason ? (
                        <p className="text-xs text-muted-foreground">{entry.detection.reason}</p>
                      ) : null}
                      {entry.error ? (
                        <p className="text-xs text-destructive">{entry.error}</p>
                      ) : null}
                      {newName ? (
                        <p className="truncate font-mono text-xs text-emerald-700" title={newName}>
                          → {newName}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleDownload(entry)}
                        disabled={!dataType || !isValidClosingDate(closingDate) || !isValidPayeeNumber(payeeNumber)}
                      >
                        ダウンロード
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(entry.id)}>
                        削除
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
