"use client";

/**
 * セゾン申込書（審査FMT）セクション（加盟店申請の登録手続き内）
 *
 * 申請データ＋UD追記から審査FMT.xlsx（セゾン提供様式・マクロなし）を自動生成する。
 * 不足項目があれば「何を先に済ませるべきか」を表示。提出はクリプト便。
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildSaisonConnectionInfo,
  buildSaisonRow,
} from "@/lib/merchant-application/saison-doc";
import type { ApplicationDetail } from "@/lib/applications/types";

export interface SaisonDocSectionProps {
  detail: ApplicationDetail;
}

export function SaisonDocSection({ detail }: SaisonDocSectionProps) {
  const { errors, manualNotes } = useMemo(
    () => buildSaisonRow(detail.payload ?? null, detail.udInput ?? null),
    [detail.payload, detail.udInput]
  );
  const connection = useMemo(() => {
    const payload = (detail.payload ?? {}) as Record<string, unknown>;
    const storeName =
      typeof payload.facilityName === "string" && payload.facilityName.trim()
        ? payload.facilityName
        : typeof payload.corpName === "string"
          ? payload.corpName
          : undefined;
    return buildSaisonConnectionInfo(detail.udInput ?? null, storeName);
  }, [detail.payload, detail.udInput]);
  const [downloading, setDownloading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopyConnection() {
    if (!connection) return;
    await navigator.clipboard.writeText(connection.sheetText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
      {/* ボタンは常に表示する（不足時は無効化＋理由表示。動線が消えて迷子にならないように） */}
      <div>
        <Button
          type="button"
          disabled={downloading || errors.length > 0}
          onClick={() => void handleDownload()}
          style={{
            backgroundColor: "var(--qolc-primary)",
            color: "white",
            minHeight: 44,
            opacity: errors.length > 0 ? 0.5 : 1,
          }}
        >
          {downloading ? "生成中…" : "セゾン申込書（Excel）をダウンロード"}
        </Button>
      </div>
      {errors.length > 0 && (
        <div>
          <p className="text-sm font-medium" style={{ color: "#B45309" }}>
            ダウンロードには以下の入力が必要です（案件詳細で補完してください）:
          </p>
          <ul className="text-sm list-disc pl-5" style={{ color: "#B45309" }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {errors.length === 0 && manualNotes.length > 0 && (
        <ul className="text-sm list-disc pl-5" style={{ color: "var(--qolc-muted)" }}>
          {manualNotes.map((n) => (
            <li key={n}>ダウンロード後にExcelで補完: {n}</li>
          ))}
        </ul>
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
      <div
        className="text-sm border rounded-md px-4 py-3 flex flex-col gap-2"
        style={{ borderColor: "var(--qolc-border)" }}
      >
        <p className="font-medium">接続情報票（申請時に同送）</p>
        <p style={{ color: "var(--qolc-muted)" }}>
          加盟店登録だけでは非対面決済のオーソリ・売上受け込みはできません。
          審査FMTと併せて以下の接続情報票をクリプト便で同送してください
          （2026-09 セゾンへ申請時同送への一本化を申し入れ済み。経緯は
          docs/saison-connection-flow-issue-20260907.md）。
        </p>
        {connection ? (
          <>
            <dl className="grid grid-cols-[14em_1fr] gap-y-1">
              <dt style={{ color: "var(--qolc-muted)" }}>モールコード</dt>
              <dd className="font-medium tabular-nums">{connection.mallCode}</dd>
              <dt style={{ color: "var(--qolc-muted)" }}>センターコード（仕向け）</dt>
              <dd className="font-medium tabular-nums">{connection.centerCode}</dd>
              <dt style={{ color: "var(--qolc-muted)" }}>サブコード</dt>
              <dd className="font-medium tabular-nums">{connection.subCode}</dd>
              <dt style={{ color: "var(--qolc-muted)" }}>端末識別番号</dt>
              <dd className="font-medium tabular-nums">{connection.terminalId}</dd>
            </dl>
            <div>
              <Button
                type="button"
                variant="outline"
                style={{ minHeight: 44 }}
                onClick={() => void handleCopyConnection()}
              >
                {copied ? "コピーしました" : "接続情報票をコピー"}
              </Button>
            </div>
          </>
        ) : (
          <p style={{ color: "#B45309" }}>
            端末識別番号が未採番のため表示できません。先に「② 採番」を実行してください。
          </p>
        )}
      </div>
    </div>
  );
}
