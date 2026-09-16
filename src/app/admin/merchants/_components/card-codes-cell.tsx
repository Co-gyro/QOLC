/**
 * 加盟店一覧のカード会社番号セル（JCB / セゾン）
 * JCBは加盟店番号1本で登録型・都度型を包含（販売形態区分11・2026-09-16 JCB回答）。
 * DBは後方互換で両カラム保持のため、表示は recurring ?? ec を採用する。
 */
"use client";

import type { MerchantCardCodes } from "../_lib/card-codes";

/** ラベルつき1行（未登録は "未登録" を薄色表示） */
function Line({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-1 text-xs whitespace-nowrap">
      <span style={{ color: "var(--qolc-muted)" }}>{label}:</span>
      {value ? (
        <span className="font-mono" style={{ color: "var(--qolc-text)" }}>
          {value}
        </span>
      ) : (
        <span style={{ color: "var(--qolc-muted)" }}>未登録</span>
      )}
    </div>
  );
}

export function CardCodesCell({
  codes,
  onEdit,
}: {
  codes: MerchantCardCodes | null;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <Line label="JCB" value={codes?.jcbRecurring ?? codes?.jcbEc ?? null} />
      <Line label="セゾン" value={codes?.saison ?? null} />
      <button
        className="text-sm underline text-left"
        style={{ color: "var(--qolc-primary)" }}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        番号を編集
      </button>
    </div>
  );
}
