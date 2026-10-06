import type { UdpayCustomer, UdpayInvoice, UdpayPayment, UdpayStore } from "./types";
import {
  chargeDateFor,
  computeTotals,
  effectiveChargeDate,
  formatDateJa,
  todayJst,
} from "./logic";
import {
  documentNumber,
  documentSubject,
  formatSlashDate,
  receiptRows,
  taxBreakdown,
} from "./documents";

/**
 * ストアの請求・決済から帳票（請求書・領収証）の表示データを作る。
 * 画面コンポーネントは表示だけを担い、日付・番号・支払方法の決め方はここに集める。
 */

/** ISO 日時を日本時間の "YYYY-MM-DD" にする */
function jstDate(iso: string): string {
  return todayJst(new Date(iso));
}

/** 支払方法の表示（例: クレジットカード（Visa 下4桁 4242）） */
export function paymentMethodLabel(customer: UdpayCustomer): string {
  const last4 = customer.card.maskedNumber?.slice(-4);
  return `クレジットカード（${customer.card.brand ?? ""}${last4 ? ` 下4桁 ${last4}` : ""}）`;
}

/** 請求書の表示データ（請求日はメール送付日。未送付なら今日） */
export function buildInvoiceDocumentData(store: UdpayStore, invoice: UdpayInvoice, customer: UdpayCustomer) {
  const payment = store.payments.find((p) => p.invoiceId === invoice.id);
  const today = todayJst();
  const chargeDate =
    payment?.scheduledDate ?? effectiveChargeDate(chargeDateFor(invoice.month, customer.anniversaryDay), today);
  const totals = computeTotals(invoice.lines);
  return {
    customerName: customer.name,
    number: documentNumber(invoice, store.customers),
    issueDate: formatSlashDate(invoice.mailSentAt ? jstDate(invoice.mailSentAt) : today),
    subject: documentSubject(invoice.month),
    chargeDate,
    paymentMethod: paymentMethodLabel(customer),
    lines: invoice.lines,
    ...totals,
  };
}

/** 領収証の表示データ（発行日・領収日は入金日） */
export function buildReceiptDocumentData(
  store: UdpayStore,
  invoice: UdpayInvoice,
  customer: UdpayCustomer,
  payment: UdpayPayment,
) {
  const paidDate = formatDateJa(payment.paidAt ? jstDate(payment.paidAt) : payment.scheduledDate);
  return {
    customerName: customer.name,
    postalCode: customer.postalCode,
    address1: customer.address1,
    address2: customer.address2,
    number: documentNumber(invoice, store.customers),
    issueDate: paidDate,
    paidDate,
    subject: documentSubject(invoice.month),
    rows: receiptRows(invoice.lines),
    breakdown: taxBreakdown(invoice.lines),
    paymentNote: `お支払方法: ${paymentMethodLabel(customer)}による決済`,
  };
}
