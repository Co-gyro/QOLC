import Link from "next/link";
import type { UdpayDisplayStatus } from "@/lib/udpay/status";
import { ActionButton } from "../action-button";

/**
 * 入金管理の行ごとの操作（要望7）。
 * 課金予約=下書きに戻す／決済確定=取り消す（課金日の前日まで）／与信落ち=再決済／入金済み=領収書。
 * セル内は div で横並びにする（td 自体に display:flex を付けると表の罫線がずれるため）。
 */
export function RowActions({
  invoiceId,
  paymentId,
  status,
  cancellable,
}: {
  invoiceId: string;
  paymentId?: string;
  status: UdpayDisplayStatus;
  cancellable: boolean;
}) {
  return (
    <div className="up-actions">
      {status === "reserved" && (
        <ActionButton
          action="revertToDraft"
          payload={{ invoiceId }}
          label="下書きに戻す"
          className="up-btn secondary small"
        />
      )}
      {status === "confirmed" && cancellable && (
        <ActionButton
          action="cancelConfirmation"
          payload={{ invoiceId }}
          label="決済確定を取り消す"
          className="up-btn secondary small"
          confirmMessage="決済確定を取り消して課金予約に戻します。請求メールは送付済みのため、訂正のご連絡が必要です。よろしいですか？"
        />
      )}
      {status === "failed" && paymentId && (
        <ActionButton
          action="retryPayment"
          payload={{ paymentId }}
          label="再決済"
          className="up-btn small"
        />
      )}
      {status === "paid" && paymentId && (
        <Link className="up-btn secondary small" href={`/udpay/receipts/${paymentId}`}>
          領収書
        </Link>
      )}
      <Link className="up-btn secondary small" href={`/udpay/invoices/${invoiceId}`}>
        請求
      </Link>
    </div>
  );
}
