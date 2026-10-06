import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import { buildReceiptDocumentData } from "@/lib/udpay/document-data";
import { DEMO_MERCHANT } from "@/lib/udpay/merchant-profile";
import { ReceiptDocument } from "../../_documents/receipt-document";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * 領収証（印刷用・ランサイド様指定フォーマット）。入金済みの決済に対して発行する。
 * 「印刷・PDF保存」でブラウザの印刷から A4 の PDF にできる。
 */
export default async function UdpayReceiptPage({ params }: { params: { paymentId: string } }) {
  const store = await loadStore();
  const payment = store.payments.find((p) => p.id === params.paymentId);
  const invoice = payment ? store.invoices.find((i) => i.id === payment.invoiceId) : undefined;
  const customer = payment ? store.customers.find((c) => c.id === payment.customerId) : undefined;

  if (!payment || !invoice || !customer || payment.status !== "paid") {
    return (
      <main className="up-container">
        <p className="up-error">領収書が見つかりません（入金済みの決済のみ発行されます）。</p>
        <Link className="up-btn secondary" href="/udpay/payments">
          入金管理へ戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="up-container" style={{ maxWidth: "none" }}>
      <div className="up-doc-toolbar">
        <Link className="up-btn secondary" href={`/udpay/payments?month=${invoice.month}`}>
          ← 入金管理へ戻る
        </Link>
        <PrintButton />
      </div>
      <ReceiptDocument
        data={buildReceiptDocumentData(store, invoice, customer, payment)}
        merchant={DEMO_MERCHANT}
      />
    </main>
  );
}
