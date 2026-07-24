"use client";

/**
 * セゾン申込書（審査FMT）セクション（加盟店申請の登録手続き内）
 *
 * 申請データ＋UD追記から審査FMT.xlsx（セゾン提供様式・マクロなし）を自動生成する。
 * 不足項目があれば「何を先に済ませるべきか」を表示。提出はクリプト便。
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildSaisonRow } from "@/lib/merchant-application/saison-doc";
import type { ApplicationDetail } from "@/lib/applications/types";

export interface SaisonDocSectionProps {
  detail: ApplicationDetail;
}

export function SaisonDocSection({ detail }: SaisonDocSectionProps) {
  const { errors, manualNotes } = useMemo(
    () => buildSaisonRow(detail.payload ?? null, detail.udInput ?? null),
    [detail.payload, detail.udInput]
  );
  const [downloading, setDownloading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/admin/applications/${detail.id}/saison-doc`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `生成に失敗しました（${res.status}）`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
      const filename = m ? decodeURIComponent(m[1]) : "saison.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        セゾン提供の審査FMT（Excel）に申請内容・UD追記・採番値を自動転記します。
        カナ列は半角カナへ自動変換されます。
      </p>
      {errors.length > 0 ? (
        <ul className="text-sm list-disc pl-5" style={{ color: "#B45309" }}>
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : (
        <>
          <div>
            <Button
              type="button"
              disabled={downloading}
              onClick={() => void handleDownload()}
              style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
            >
              {downloading ? "生成中…" : "セゾン申込書（Excel）をダウンロード"}
            </Button>
          </div>
          {manualNotes.length > 0 && (
            <ul className="text-sm list-disc pl-5" style={{ color: "var(--qolc-muted)" }}>
              {manualNotes.map((n) => (
                <li key={n}>ダウンロード後にExcelで補完: {n}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {fetchError && (
        <p className="text-sm" style={{ color: "#DC2626" }}>
          {fetchError}
        </p>
      )}
      <p
        className="text-sm border rounded-md px-4 py-3"
        style={{ borderColor: "var(--qolc-border)", color: "var(--qolc-muted)" }}
      >
        提出方法: セゾンへは<span className="font-medium">クリプト便</span>で送付します
        （2026-07 セゾン連絡。メール添付ではありません）。送付したら「④ 提出の記録」を忘れずに。
      </p>
    </div>
  );
}
