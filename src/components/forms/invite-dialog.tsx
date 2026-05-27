"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { createInvitation } from "@/lib/portal/facility-queries";
import type { ResidentRow } from "@/lib/portal/facility-queries";

export interface InviteDialogProps {
  open: boolean;
  resident: ResidentRow | null;
  onClose: () => void;
}

export function InviteDialog({ open, resident, onClose }: InviteDialogProps) {
  const [accountType, setAccountType] = useState<"self" | "family">("family");
  const [isPaymentOwner, setIsPaymentOwner] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; expiresAt: string; qr: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setResult(null);
    setError(null);
    setCopied(false);
    setAccountType("family");
    setIsPaymentOwner(true);
  }

  if (!open || !resident) return null;

  async function issue() {
    if (!resident) return;
    setError(null);
    setIssuing(true);
    try {
      const inv = await createInvitation(resident.id, { accountType, isPaymentOwner });
      const qr = await QRCode.toDataURL(inv.url, { width: 240, margin: 1 });
      setResult({ url: inv.url, expiresAt: inv.expiresAt, qr });
    } catch (e) {
      setError(e instanceof Error ? e.message : "招待の発行に失敗しました");
    } finally {
      setIssuing(false);
    }
  }

  async function copyUrl() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={handleClose}
    >
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-1">家族を招待</h2>
        <p className="text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
          {resident.nameLast} {resident.nameFirst} さんのアカウント招待
        </p>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">アカウント種別</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as "self" | "family")}
                className="w-full border rounded px-3 py-2"
                style={{ borderColor: "var(--qolc-border)", minHeight: 44 }}
              >
                <option value="family">ご家族</option>
                <option value="self">ご本人</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPaymentOwner} onChange={(e) => setIsPaymentOwner(e.target.checked)} />
              支払い担当者にする（カード登録が可能になります）
            </label>
            <p className="text-xs" style={{ color: "var(--qolc-muted)" }}>
              発行後、招待リンクとQRコードを表示します。印刷・コピーしてご家族へお渡しください（有効期限14日）。
            </p>
            {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                キャンセル
              </Button>
              <Button onClick={issue} disabled={issuing} style={{ backgroundColor: "var(--qolc-primary)", color: "white" }}>
                {issuing ? "発行中..." : "招待を発行"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.qr} alt="招待QRコード" width={240} height={240} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">招待リンク</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={result.url}
                  className="flex-1 border rounded px-3 py-2 text-sm"
                  style={{ borderColor: "var(--qolc-border)" }}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button onClick={copyUrl} variant="outline">
                  {copied ? "コピー済" : "コピー"}
                </Button>
              </div>
            </div>
            <p className="text-xs" style={{ color: "var(--qolc-muted)" }}>
              有効期限: {new Date(result.expiresAt).toLocaleDateString("ja-JP")} まで。1回のみ使用できます。
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={reset} variant="outline">
                別の招待を発行
              </Button>
              <Button onClick={handleClose} style={{ backgroundColor: "var(--qolc-primary)", color: "white" }}>
                閉じる
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
