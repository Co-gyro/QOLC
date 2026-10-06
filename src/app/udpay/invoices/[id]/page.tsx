import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import {
  canCancelConfirmation,
  chargeDateFor,
  computeTotals,
  effectiveChargeDate,
  formatDateJa,
  formatMonthJa,
  formatYen,
  todayJst,
} from "@/lib/udpay/logic";
import { displayStatusOf } from "@/lib/udpay/status";
import { UdpayHeader } from "../../header";
import { ActionButton } from "../../action-button";
import { StatusBadge } from "../../_components/status";
import { InvoiceEditor } from "./invoice-editor";
import { InvoiceLinesTable } from "./invoice-lines-table";
import { MailEditor } from "./mail-editor";

export const dynamic = "force-dynamic";

/**
 * 請求書の詳細画面。
 * 下書き=明細編集（下書き保存／課金予約）、課金予約=下書きに戻す、決済確定=課金日の前日まで取消。
 * どの状態でも請求メールのプレビューを表示し、決済確定前は件名・追記コメントを編集できる。
 */
export default async function UdpayInvoiceDetailPage({ params }: { params: { id: string } }) {
  const store = await loadStore();
  const invoice = store.invoices.find((i) => i.id === params.id);
  const customer = invoice ? store.customers.find((c) => c.id === invoice.customerId) : undefined;
  if (!invoice || !customer) {
    return (
      <div>
        <UdpayHeader />
        <main className="up-container">
          <p className="up-error">請求書が見つかりません。</p>
          <Link className="up-btn secondary" href="/udpay/invoices">請求管理へ戻る</Link>
        </main>
      </div>
    );
  }

  const today = todayJst();
  const payment = store.payments.find((p) => p.invoiceId === invoice.id);
  const status = displayStatusOf(invoice, payment);
  const totals = computeTotals(invoice.lines);
  const planned = chargeDateFor(invoice.month, customer.anniversaryDay);
  const chargeDate = payment?.scheduledDate ?? effectiveChargeDate(planned, today);
  const editableMail = invoice.status !== "confirmed";

  return (
    <div>
      <UdpayHeader />
      <main className="up-container">
        <p style={{ marginBottom: 8 }}>
          <Link href={`/udpay/invoices?month=${invoice.month}`}>← 請求管理へ戻る</Link>
        </p>
        <h1>
          {customer.name} — {formatMonthJa(invoice.month)}サービス分 <StatusBadge status={status} />
        </h1>
        <p className="up-lead">
          決済日: {formatDateJa(chargeDate)}（毎月{customer.anniversaryDay}日）
          {chargeDate !== planned && "／予定日を過ぎているため翌日に課金します"}
        </p>
        <p style={{ marginTop: -12 }}>
          <Link className="up-btn secondary small" href={`/udpay/invoices/${invoice.id}/document`}>
            請求書を表示（印刷・PDF保存）
          </Link>
        </p>

        {invoice.confirmationCancelledAt && invoice.status !== "confirmed" && (
          <p className="up-notice">
            決済確定を取り消しました。請求メールは送付済みのため、内容を修正した場合は顧客へ訂正のご連絡をお願いします
            （再度の一括実行で、訂正後の請求メールが送られます）。
          </p>
        )}

        {invoice.status === "draft" ? (
          <InvoiceEditor
            invoiceId={invoice.id}
            initialLines={invoice.lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
            }))}
          />
        ) : (
          <InvoiceLinesTable lines={invoice.lines} total={totals.total} />
        )}

        {invoice.status === "reserved" && (
          <div className="up-actions" style={{ marginTop: 12 }}>
            <ActionButton
              action="revertToDraft"
              payload={{ invoiceId: invoice.id }}
              label="下書きに戻す"
              className="up-btn secondary"
            />
            <span className="up-muted">
              課金予約中です。承認者が入金管理の「一括実行」を行うと、メールが送られ決済が確定します。
            </span>
          </div>
        )}

        {payment && (
          <section className="up-section up-card">
            <h2>課金状況</h2>
            <p>
              {formatDateJa(payment.scheduledDate)}に {formatYen(payment.amount)} を自動課金{" "}
              <StatusBadge status={status} />
            </p>
            <div className="up-actions">
              {payment.status === "scheduled" &&
                (canCancelConfirmation(payment.scheduledDate, today) ? (
                  <ActionButton
                    action="cancelConfirmation"
                    payload={{ invoiceId: invoice.id }}
                    label="決済確定を取り消す"
                    className="up-btn secondary"
                    confirmMessage="決済確定を取り消して課金予約に戻します。請求メールは送付済みのため、訂正のご連絡が必要です。よろしいですか？"
                  />
                ) : (
                  <span className="up-muted">課金日の当日以降は取り消せません（UDへ取消・返品をご依頼ください）。</span>
                ))}
              <Link className="up-btn secondary small" href={`/udpay/payments?month=${invoice.month}`}>
                入金管理で確認 →
              </Link>
            </div>
          </section>
        )}

        <section className="up-section">
          <h2>{editableMail ? "請求メールのプレビュー・編集" : "送付済みの請求メール"}</h2>
          <MailEditor
            invoiceId={invoice.id}
            editable={editableMail}
            to={customer.email}
            cc={customer.cc}
            source={{
              customerName: customer.name,
              contactName: customer.contactName,
              month: invoice.month,
              total: totals.total,
              chargeDate,
              lines: invoice.lines,
            }}
            initialSubject={invoice.mailSubject}
            initialComment={invoice.mailComment}
          />
        </section>
      </main>
    </div>
  );
}
