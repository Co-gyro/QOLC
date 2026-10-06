import { formatYen } from "@/lib/udpay/logic";
import { DISPLAY_STATUS, type UdpayDisplayStatus } from "@/lib/udpay/status";

/** 集計に並べる状態の順 */
const ORDER: UdpayDisplayStatus[] = ["none", "draft", "reserved", "confirmed", "paid", "failed"];

/**
 * 一覧の上に出す状態別の件数・合計金額（例: 「課金予約 5件・¥612,000」）。
 * 0件の状態は出さない。
 */
export function StatusSummary({
  rows,
}: {
  rows: { status: UdpayDisplayStatus; amount: number }[];
}) {
  const items = ORDER.map((s) => {
    const hit = rows.filter((r) => r.status === s);
    return { s, count: hit.length, sum: hit.reduce((a, r) => a + r.amount, 0) };
  }).filter((i) => i.count > 0);
  if (items.length === 0) return null;
  return (
    <div className="up-summary" aria-label="状態別の件数と合計">
      {items.map((i) => (
        <span key={i.s} className="chip">
          {DISPLAY_STATUS[i.s].label}
          <strong>
            {i.count}件{i.s !== "none" ? `・${formatYen(i.sum)}` : ""}
          </strong>
        </span>
      ))}
    </div>
  );
}
