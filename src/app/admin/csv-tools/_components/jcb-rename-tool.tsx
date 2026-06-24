"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  detectJcbDataType,
  parseHeaderLine,
  readJcbCsvText,
} from "@/lib/csv/jcb-rename";
import {
  buildJcbFi,
  buildJcbFm,
  parseJcbTransferCsv,
  parseJcbUrCsv,
  renderCommonFi,
  renderCommonFm,
  deriveShimebiFromSaleDate,
  deriveShimebiFromTransferDate,
  type JcbTransferRow,
  type JcbUrRow,
} from "@/lib/csv/selfish-common";
import { encodeShiftJis } from "@/lib/csv/saison-fm";
import { buildCsvFilename, isValidPayeeNumber } from "@/lib/csv/naming";

/** JCBの支払先番号（EC一本化のため当面固定。店頭156745176はEC側におまとめ）。 */
const DEFAULT_JCB_PAYEE = "156742401";

type JcbKind = "UR" | "FI" | "FM_OLD" | "UNKNOWN";

interface Entry {
  id: string;
  file: File;
  kind: JcbKind | null;
  urRows: JcbUrRow[] | null;
  fiRows: JcbTransferRow[] | null;
  /** UR(売上明細)のデコード済みテキスト。Shift-JISで再出力するため保持。 */
  rawText: string | null;
  note: string;
  error: string | null;
  loading: boolean;
}

interface OutputFile {
  kind: "UR" | "FI" | "FM";
  filename: string;
  bytes: Uint8Array<ArrayBuffer>;
  note: string;
  srcFile?: File;
}

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function dropClass(isDragging: boolean) {
  return cn(
    "flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/50",
  );
}
/** yyyy/mm/dd → yyyymmdd（命名規則用）。 */
function toYyyymmdd(slashed: string): string {
  return slashed.replace(/\//g, "");
}

export function JcbRenameTool() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [payeeNumber, setPayeeNumber] = useState(DEFAULT_JCB_PAYEE);
  const [outputs, setOutputs] = useState<OutputFile[] | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: File[]) => {
    const accepted = files.filter((f) => /\.csv$/i.test(f.name));
    if (accepted.length === 0) return;
    const next: Entry[] = accepted.map((file) => ({
      id: createId(), file, kind: null, urRows: null, fiRows: null, rawText: null, note: "", error: null, loading: true,
    }));
    setEntries((prev) => [...prev, ...next]);
    for (const entry of next) {
      (async () => {
        try {
          const text = await readJcbCsvText(entry.file);
          const header = text.split(/\r\n|\n|\r/)[0] ?? "";
          const det = detectJcbDataType(parseHeaderLine(header));
          let patch: Partial<Entry>;
          if (det.dataType === "UR") {
            patch = { kind: "UR", urRows: parseJcbUrCsv(text), rawText: text, note: "売上明細(UR)→ UR(Shift-JIS化)＋FM(共通)を生成" };
          } else if (det.dataType === "FI") {
            patch = { kind: "FI", fiRows: parseJcbTransferCsv(text), note: "振込情報(FI)→ FI(共通)を生成" };
          } else if (det.dataType === "FM") {
            patch = { kind: "FM_OLD", note: "振込明細(集計日なし)→ FMは売上明細から生成するため未使用" };
          } else {
            patch = { kind: "UNKNOWN", note: "判別不可（売上明細レポート等は不要）" };
          }
          setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...patch, loading: false } : e)));
        } catch (err) {
          setEntries((prev) =>
            prev.map((e) => (e.id === entry.id ? { ...e, loading: false, error: err instanceof Error ? err.message : "読込失敗" } : e)),
          );
        }
      })();
    }
  }, []);

  const urEntries = useMemo(() => entries.filter((e) => e.kind === "UR" && e.urRows), [entries]);
  const fiEntries = useMemo(() => entries.filter((e) => e.kind === "FI" && e.fiRows), [entries]);
  const loadingAny = entries.some((e) => e.loading);
  const payeeOk = isValidPayeeNumber(payeeNumber);
  const canGenerate = payeeOk && !loadingAny && (urEntries.length > 0 || fiEntries.length > 0);

  const handleGenerate = useCallback(() => {
    setGenError(null);
    const out: OutputFile[] = [];
    try {
      // 締日: 売上明細の売上年月日 → 振込情報の振込年月日 の順で算出
      let closing = "";
      const ur0 = urEntries[0]?.urRows?.[0];
      const fi0 = fiEntries[0]?.fiRows?.[0];
      if (ur0) closing = toYyyymmdd(deriveShimebiFromSaleDate(ur0.売上年月日));
      else if (fi0) closing = toYyyymmdd(deriveShimebiFromTransferDate(fi0.振込年月日));

      for (const e of urEntries) {
        // UR: 生データの内容を保持しつつ Shift-JIS で出力（JCB原本はUTF-8のため変換。列・行は無加工）
        out.push({
          kind: "UR",
          filename: buildCsvFilename({ issuer: "JCB", dataType: "UR", closingDate: closing, payeeNumber }),
          bytes: encodeShiftJis(e.rawText ?? ""),
          note: `${e.file.name}（Shift-JIS変換のみ・列/行は無加工）`,
        });
        // FM: 売上明細を集計 → 共通フォーマット
        const fmRows = buildJcbFm(e.urRows!);
        out.push({
          kind: "FM",
          filename: buildCsvFilename({ issuer: "JCB", dataType: "FM", closingDate: closing, payeeNumber }),
          bytes: encodeShiftJis(renderCommonFm(fmRows)),
          note: `共通FM ${fmRows.length}行 / 集計日(売上日)単位`,
        });
      }
      for (const e of fiEntries) {
        const fiRows = buildJcbFi(e.fiRows!);
        out.push({
          kind: "FI",
          filename: buildCsvFilename({ issuer: "JCB", dataType: "FI", closingDate: closing, payeeNumber }),
          bytes: encodeShiftJis(renderCommonFi(fiRows)),
          note: `共通FI ${fiRows.length}行`,
        });
      }
      if (out.length === 0) {
        setGenError("生成できる出力がありません。売上明細(sales_details)や振込情報(transfer)を投入してください。");
        setOutputs(null);
        return;
      }
      setOutputs(out);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "生成に失敗しました。");
      setOutputs(null);
    }
  }, [urEntries, fiEntries, payeeNumber]);

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
      a.download = "JCB_変換結果.zip";
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
      if (files.length > 0) addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>JCB CSV変換（UR / FI / FM）</CardTitle>
          <CardDescription>
            JCB Linkからダウンロードした <span className="font-medium">売上明細(sales_details)・振込情報(transfer)</span> を投入すると、
            <span className="font-medium">UR（生データのリネーム）・FI/FM（JCB/SAISON共通フォーマット）</span>を生成します。
            締日は15日締めで算出、支払先番号は固定。FMは売上明細から集計日(売上日)単位で生成します。（**全出力 Shift-JIS / CRLF** に統一。JCB原本UTF-8のURも内容そのままShift-JIS化）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:max-w-md">
            <div className="space-y-2">
              <Label htmlFor="jcb-payee">支払先番号（固定: 156742401）</Label>
              <Input
                id="jcb-payee"
                inputMode="numeric"
                maxLength={9}
                value={payeeNumber}
                onChange={(e) => setPayeeNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
              />
              {payeeNumber.length > 0 && !payeeOk ? (
                <p className="text-xs text-destructive">9桁の数字で入力してください。</p>
              ) : (
                <p className="text-xs text-muted-foreground">EC一本化のため固定。締日はファイルから自動算出します。</p>
              )}
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => inputRef.current?.click()}
            className={dropClass(isDragging)}
          >
            <p className="text-sm font-medium">JCB CSVをドラッグ＆ドロップ</p>
            <p className="mt-1 text-xs text-muted-foreground">またはクリックして選択（複数可）</p>
            <input ref={inputRef} type="file" accept=".csv,text/csv" multiple className="hidden"
              onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
          </div>

          {entries.length > 0 ? (
            <ul className="divide-y rounded-md border text-sm">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm" title={e.file.name}>{e.file.name}</p>
                    {e.loading ? <p className="text-xs text-muted-foreground">判別中…</p>
                      : e.error ? <p className="text-xs text-destructive">{e.error}</p>
                      : <p className="text-xs text-muted-foreground">{e.note}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEntries((prev) => prev.filter((x) => x.id !== e.id))}>削除</Button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-center gap-3">
            <Button onClick={handleGenerate} disabled={!canGenerate}>変換を生成</Button>
            {!canGenerate ? (
              <p className="text-xs text-muted-foreground">支払先番号と、売上明細(sales_details)または振込情報(transfer)が必要です。</p>
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
              <CardDescription>UR（生データ）/ FI・FM（共通フォーマット）。個別 or ZIPでDL。</CardDescription>
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
