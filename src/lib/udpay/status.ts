import type { UdpayInvoice, UdpayPayment } from "./types";

/**
 * 請求の表示状態（請求管理・入金管理・ダッシュボードで共通）。
 * 名前と色を全画面でそろえる: 下書き=灰／課金予約=橙／決済確定=青／入金済み=緑／与信落ち=赤。
 */
export type UdpayDisplayStatus = "none" | "draft" | "reserved" | "confirmed" | "paid" | "failed";

/** 状態の表示名・説明（凡例に使う） */
export const DISPLAY_STATUS: Record<
  UdpayDisplayStatus,
  { label: string; description: string }
> = {
  none: { label: "未作成", description: "この月の請求はまだありません" },
  draft: { label: "下書き", description: "作成中。メール・課金はまだ" },
  reserved: { label: "課金予約", description: "担当者が確定。承認者の一括実行待ち（メール未送付）" },
  confirmed: { label: "決済確定", description: "メール送付済み。決済日に自動で課金" },
  paid: { label: "入金済み", description: "課金が完了" },
  failed: { label: "与信落ち", description: "課金できなかった。顧客へ連絡し再決済" },
};

/** 凡例に並べる順 */
export const LEGEND_ORDER: UdpayDisplayStatus[] = [
  "draft",
  "reserved",
  "confirmed",
  "paid",
  "failed",
];

/** 請求と決済から表示状態を決める */
export function displayStatusOf(
  invoice: UdpayInvoice | undefined,
  payment: UdpayPayment | undefined,
): UdpayDisplayStatus {
  if (!invoice) return "none";
  if (invoice.status === "draft") return "draft";
  if (invoice.status === "reserved") return "reserved";
  if (payment?.status === "paid") return "paid";
  if (payment?.status === "failed") return "failed";
  return "confirmed";
}

/** 絞り込みに使える状態か（URL の値の検証） */
export function parseStatusFilter(value: string | undefined): UdpayDisplayStatus | null {
  return value && value in DISPLAY_STATUS ? (value as UdpayDisplayStatus) : null;
}
