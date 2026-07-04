/**
 * カード会社番号（JCB 2種 + セゾン）の編集ダイアログ
 *
 * 審査結果で発番された加盟店番号を加盟店へ登録・修正する。
 * 更新は監査ログ付きAPI（card-codes）経由。
 */
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  updateMerchantCardCodes,
  validateCardCodes,
  type MerchantCardCodes,
} from "../_lib/card-codes";

export interface CardCodesDialogProps {
  open: boolean;
  merchantId: string | null;
  merchantName: string;
  current: MerchantCardCodes | null;
  onClose: () => void;
  onSaved: () => void;
}

const INPUT_CLASS = "border rounded px-2 py-2 text-sm w-full bg-white";
const INPUT_STYLE = { borderColor: "var(--qolc-border)", minHeight: 44 };

export function CardCodesDialog({
  open,
  merchantId,
  merchantName,
  current,
  onClose,
  onSaved,
}: CardCodesDialogProps) {
  const [codes, setCodes] = useState<MerchantCardCodes>({
    jcbRecurring: null,
    jcbEc: null,
    saison: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCodes(current ?? { jcbRecurring: null, jcbEc: null, saison: null });
      setError(null);
      setSaving(false);
    }
  }, [open, current]);

  if (!open || !merchantId) return null;

  /** 検証して保存する */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateCardCodes(codes);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateMerchantCardCodes(merchantId as string, codes);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof MerchantCardCodes) => (v: string) =>
    setCodes((prev) => ({ ...prev, [key]: v || null }));

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <form className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className="text-lg font-bold" style={{ color: "var(--qolc-text)" }}>
          加盟店番号を編集
        </h2>
        <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
          「{merchantName}」のカード会社番号を登録します。
          施設ごとに2種類のJCB加盟店番号（登録型・都度型EC）が必要です。
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>JCB加盟店番号（登録型）</span>
          <input type="text" className={INPUT_CLASS} style={INPUT_STYLE}
            value={codes.jcbRecurring ?? ""} maxLength={17} placeholder="半角数字（最大17桁）"
            onChange={(e) => set("jcbRecurring")(e.target.value)} />
          <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
            会員ID決済・継続課金用
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>JCB加盟店番号（都度型EC）</span>
          <input type="text" className={INPUT_CLASS} style={INPUT_STYLE}
            value={codes.jcbEc ?? ""} maxLength={17} placeholder="半角数字（最大17桁）"
            onChange={(e) => set("jcbEc")(e.target.value)} />
          <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
            カード登録時のトークン決済用
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>セゾン加盟店番号</span>
          <input type="text" className={INPUT_CLASS} style={INPUT_STYLE}
            value={codes.saison ?? ""} maxLength={7} placeholder="半角数字（通常7桁）"
            onChange={(e) => set("saison")(e.target.value)} />
        </label>
        {error && (
          <p className="text-sm" style={{ color: "#DC2626" }}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} style={{ minHeight: 44 }}>
            キャンセル
          </Button>
          <Button type="submit" disabled={saving}
            style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </form>
    </div>
  );
}
