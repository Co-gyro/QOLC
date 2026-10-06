import { DISPLAY_STATUS, LEGEND_ORDER, type UdpayDisplayStatus } from "@/lib/udpay/status";
import {
  CARD_EXPIRY_LABELS,
  cardExpiryStatus,
  formatExpireYm,
} from "@/lib/payment/card-expiry";
import type { UdpayCard } from "@/lib/udpay/types";

/** 請求の状態バッジ（全画面で同じ名前・色） */
export function StatusBadge({ status }: { status: UdpayDisplayStatus }) {
  return <span className={`up-badge ${status}`}>{DISPLAY_STATUS[status].label}</span>;
}

/** 状態の凡例（画面上部に表示） */
export function StatusLegend() {
  return (
    <div className="up-legend" aria-label="状態の凡例">
      {LEGEND_ORDER.map((s) => (
        <span key={s} className="item">
          <StatusBadge status={s} />
          {DISPLAY_STATUS[s].description}
        </span>
      ))}
    </div>
  );
}

/**
 * 登録カードの表示（ブランド・下4桁・有効期限と「期限間近／期限切れ」の印）。
 */
export function CardSummary({ card, today }: { card: UdpayCard; today: string }) {
  if (!card.registered) return <span className="up-badge failed">カード未登録</span>;
  const status = cardExpiryStatus(card.expireYm, today);
  return (
    <div>
      <div>
        {card.brand} {card.maskedNumber?.slice(-4) ? `下4桁 ${card.maskedNumber.slice(-4)}` : ""}
      </div>
      <div className="up-muted">
        有効期限 {formatExpireYm(card.expireYm)}
        {(status === "expiring" || status === "expired") && (
          <span className={`up-badge ${status}`} style={{ marginLeft: 6 }}>
            {CARD_EXPIRY_LABELS[status]}
          </span>
        )}
      </div>
    </div>
  );
}
