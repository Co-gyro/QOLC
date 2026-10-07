/**
 * QOLC Wallet の記録・明細行の状態バッジ（iPhone アプリと同じ呼び名）。
 */

const DECLARATION_LABELS: Record<string, { label: string; bg: string; fg: string }> = {
  selecting: { label: "支払い前", bg: "#F3F4F6", fg: "#4B5563" },
  awaiting_receipt: { label: "レシート待ち", bg: "#FFF4E8", fg: "#B45309" },
  declared: { label: "記録済み", bg: "#F3F4F6", fg: "#333333" },
  matched: { label: "レシート確認済み", bg: "#F0F9F4", fg: "#3D7A55" },
  mismatched: { label: "要確認", bg: "#FDECEC", fg: "#B42318" },
  needs_review: { label: "要確認", bg: "#FDECEC", fg: "#B42318" },
  confirmed: { label: "確定", bg: "#F0F9F4", fg: "#3D7A55" },
  reconciled: { label: "明細と照合済み", bg: "#E6F4EA", fg: "#2F6B47" },
  cancelled: { label: "取消", bg: "#F3F4F6", fg: "#6B7280" },
};

const LINE_LABELS: Record<string, { label: string; bg: string; fg: string }> = {
  matched: { label: "照合済み", bg: "#E6F4EA", fg: "#2F6B47" },
  needs_review: { label: "要確認", bg: "#FDECEC", fg: "#B42318" },
  unmatched: { label: "未突合", bg: "#F3F4F6", fg: "#4B5563" },
  excluded: { label: "対象外", bg: "#F3F4F6", fg: "#6B7280" },
};

/** バッジの見た目 */
function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span className="inline-block rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

/** 記録の状態 */
export function DeclarationStatusBadge({ status }: { status: string }) {
  return <Badge {...(DECLARATION_LABELS[status] ?? { label: status, bg: "#F3F4F6", fg: "#333333" })} />;
}

/** 明細行の突合の状態 */
export function LineStatusBadge({ status }: { status: string }) {
  return <Badge {...(LINE_LABELS[status] ?? { label: status, bg: "#F3F4F6", fg: "#333333" })} />;
}

/** "¥1,234" */
export function yen(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `¥${value.toLocaleString("ja-JP")}`;
}

/** "10/13 14:05"（日本時間） */
export function jstDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
