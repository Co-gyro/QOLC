/**
 * Selfish（精算システム）登録ダイアログ
 *
 * 開通後の「セルフィッシュへ支払先を登録」工程を、ここから行う。
 * - サーバーで組み立てた登録データとチェックリストを表示（登録票）
 * - 「Selfish へ登録」は不足項目がなく連携先が設定済みのときだけ有効（ボタンは常に表示し理由を出す）
 * - JSON をコピーして Selfish の取込画面に貼る手動経路も残す（連携停止時のフォールバック）
 */
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchSelfishPreview, registerToSelfish, type SelfishPreview } from "../_lib/selfish";
import { SelfishIssueList, SelfishPayloadTable } from "./selfish-payload-view";

export interface SelfishDialogProps {
  open: boolean;
  merchantId: string | null;
  onClose: () => void;
}

const RESULT_LABELS: Record<string, string> = {
  created: "新規登録しました",
  updated: "既存の登録を更新しました",
  unchanged: "既に同じ内容で登録済みです（変更なし）",
};

export function SelfishDialog({ open, merchantId, onClose }: SelfishDialogProps) {
  const [preview, setPreview] = useState<SelfishPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !merchantId) return;
    setPreview(null);
    setError(null);
    setDone(null);
    setCopied(false);
    fetchSelfishPreview(merchantId)
      .then(setPreview)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "取得に失敗しました"));
  }, [open, merchantId]);

  if (!open || !merchantId) return null;

  const json = preview ? JSON.stringify(preview.payload, null, 2) : "";
  const disabledReason = !preview
    ? "読み込み中"
    : !preview.ready
      ? "不足項目があります（上のチェックリストを解消してください）"
      : !preview.configured
        ? "連携先が未設定です（SELFISH_API_BASE_URL / SELFISH_PARTNER_KEY）。JSON をコピーして Selfish の取込画面へ貼ってください"
        : null;

  /** 送信（サーバー側で再構築・署名） */
  async function handleRegister() {
    if (!merchantId) return;
    setSending(true);
    setError(null);
    try {
      const r = await registerToSelfish(merchantId);
      setDone(`${RESULT_LABELS[r.result] ?? r.result}（request-id: ${r.request_id}）`);
      setPreview(await fetchSelfishPreview(merchantId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  /** JSON をクリップボードへ */
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      setError("コピーできませんでした。テキストを選択して手動でコピーしてください");
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold" style={{ color: "var(--qolc-text)" }}>
          Selfish（精算）へ支払先を登録{preview ? `：${preview.merchant_name}` : ""}
        </h2>
        <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
          審査通過・USEN 開通後に行います。Selfish は明細を「店子の加盟店番号」で店舗に突合するため、
          JCB（14桁）とセゾン（加盟店No.7桁+店舗No.7桁）を必ず登録します。
        </p>

        {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}
        {done && (
          <p className="text-sm rounded px-3 py-2" style={{ backgroundColor: "var(--qolc-bg-soft)", color: "var(--qolc-primary)" }}>
            {done}
          </p>
        )}
        {preview?.last && (
          <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
            前回の送信: {new Date(preview.last.at).toLocaleString("ja-JP")}（{preview.last.result}）
          </p>
        )}

        {!preview && !error && <p className="text-sm">読み込み中…</p>}
        {preview && (
          <>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">チェックリスト</h3>
              <SelfishIssueList issues={preview.issues} applicationId={preview.application_id} />
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">登録票（Selfish の入力順）</h3>
              <SelfishPayloadTable payload={preview.payload} />
            </section>
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">連携データ（JSON）</h3>
                <Button type="button" variant="outline" onClick={handleCopy} style={{ minHeight: 44 }}>
                  {copied ? "コピーしました" : "JSON をコピー"}
                </Button>
              </div>
              <textarea readOnly value={json} rows={8}
                className="border rounded px-2 py-2 text-sm font-mono w-full"
                style={{ borderColor: "var(--qolc-border)" }} />
            </section>
          </>
        )}

        <div className="flex flex-col gap-1 items-end">
          {disabledReason && (
            <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>{disabledReason}</span>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} style={{ minHeight: 44 }}>
              閉じる
            </Button>
            <Button type="button" onClick={handleRegister} disabled={sending || disabledReason !== null}
              style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}>
              {sending ? "送信中…" : "Selfish へ登録"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
