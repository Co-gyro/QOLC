import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import {
  buildInvoiceMail,
  chargeDateFor,
  computeTotals,
  formatDateJa,
  formatMonthJa,
  formatYen,
} from "@/lib/udpay/logic";
import { UdpayHeader } from "../../header";
import { InvoiceEditor } from "./invoice-editor";

export const dynamic = "force-dynamic";

/**
 * 請求書の詳細画面。
 * 下書きは明細エディタで編集・確定し、確定済みは内容と送付済みメールのプレビューを表示する。
 */
export default async function UdpayInvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const store = await loadStore();
  const invoice = store.invoices.find((i) => i.id === params.id);
  const customer = invoice
    ? store.customers.find((c) => c.id === invoice.customerId)
    : undefined;

  if (!invoice || !customer) {
    return (
      <div>
        <UdpayHeader />
        <main className="up-container">
          <p className="up-error">請求書が見つかりません。</p>
          <Link className="up-btn secondary" href="/udpay/invoices">
            請求管理へ戻る
          </Link>
        </main>
      </div>
    );
  }

  const totals = computeTotals(invoice.lines);
  const chargeDate = chargeDateFor(invoice.month, customer.anniversaryDay);
  const mail = buildInvoiceMail({
    customerName: customer.name,
    contactName: customer.contactName,
    month: invoice.month,
    total: totals.total,
    chargeDate,
    lines: invoice.lines,
  });
  const payment = store.payments.find((p) => p.invoiceId === invoice.id);

  return (
    <div>
      <UdpayHeader />
      <main className="up-container">
        <p style={{ marginBottom: 8 }}>
          <Link href="/udpay/invoices">← 請求管理へ戻る</Link>
        </p>
        <h1>
          {customer.name} — {formatMonthJa(invoice.month)}サービス分
        </h1>
        <p className="up-lead">
          課金予定: {formatDateJa(chargeDate)}（{customer.contactName}
          先生の初回決済日と同じ「毎月{customer.anniversaryDay}日」）
          {invoice.status === "draft" ? " ／ 状態: 下書き" : " ／ 状態: 確定済み"}
        </p>

        {invoice.status === "draft" ? (
          <>
            {!customer.card.registered && (
              <p className="up-error">
                この顧客はカード未登録のため確定できません。顧客管理から登録リンクを
                送付してください。
              </p>
            )}
            <InvoiceEditor
              invoiceId={invoice.id}
              initialLines={invoice.lines.map((l) => ({
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
              }))}
            />
          </>
        ) : (
          <>
            <div className="up-table-wrap">
              <table className="up-table">
                <thead>
                  <tr>
                    <th>摘要</th>
                    <th className="num">数量</th>
                    <th className="num">単価（税抜）</th>
                    <th className="num">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.description}</td>
                      <td className="num">{l.quantity}</td>
                      <td className="num">{formatYen(l.unitPrice)}</td>
                      <td className="num">{formatYen(l.unitPrice * l.quantity)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} className="num" style={{ fontWeight: 700 }}>
                      合計（税込）
                    </td>
                    <td className="num" style={{ fontWeight: 800 }}>
                      {formatYen(totals.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <section className="up-section">
              <h2>送付済みの請求明細メール（プレビュー）</h2>
              <div className="up-mail">
                <div className="up-mail-subject">
                  宛先: {customer.email} ／ 件名: {mail.subject}
                </div>
                <div className="up-mail-body">{mail.body}</div>
              </div>
            </section>

            {payment && (
              <section className="up-section up-card">
                <h2>課金状況</h2>
                <p>
                  {formatDateJa(payment.scheduledDate)}に{" "}
                  {formatYen(payment.amount)} を自動課金
                  {payment.status === "paid" && (
                    <span className="up-badge paid" style={{ marginLeft: 8 }}>入金済み</span>
                  )}
                  {payment.status === "failed" && (
                    <span className="up-badge failed" style={{ marginLeft: 8 }}>与信落ち</span>
                  )}
                  {payment.status === "scheduled" && (
                    <span className="up-badge scheduled" style={{ marginLeft: 8 }}>課金予約中</span>
                  )}
                </p>
                <Link className="up-btn secondary small" href="/udpay/payments">
                  入金管理で確認 →
                </Link>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
