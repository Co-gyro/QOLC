import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import { buildInvoiceDocumentData } from "@/lib/udpay/document-data";
import { DEMO_MERCHANT } from "@/lib/udpay/merchant-profile";
import { InvoiceDocument } from "../../../_documents/invoice-document";
import { PrintButton } from "../../../receipts/[paymentId]/print-button";

export const dynamic = "force-dynamic";

/**
 * 請求書（印刷用・ランサイド様指定フォーマット）。
 * 「印刷 / PDF保存」でブラウザの印刷から A4 の PDF にできる。
 */
export default async function UdpayInvoiceDocumentPage({ params }: { params: { id: string } }) {
  const store = await loadStore();
  const invoice = store.invoices.find((i) => i.id === params.id);
  const customer = invoice ? store.customers.find((c) => c.id === invoice.customerId) : undefined;
  if (!invoice || !customer) {
    return (
      <main className="up-container">
        <p className="up-error">請求書が見つかりません。</p>
        <Link className="up-btn secondary" href="/udpay/invoices">請求管理へ戻る</Link>
      </main>
    );
  }
  return (
    <main className="up-container" style={{ maxWidth: "none" }}>
      <div className="up-doc-toolbar">
        {invoice.status !== "confirmed" && (
          <span className="up-muted">決済確定前のため、内容は変わる場合があります（請求日は今日の日付で表示）。</span>
        )}
        <Link className="up-btn secondary" href={`/udpay/invoices/${invoice.id}`}>← 請求に戻る</Link>
        <PrintButton />
      </div>
      <InvoiceDocument data={buildInvoiceDocumentData(store, invoice, customer)} merchant={DEMO_MERCHANT} />
    </main>
  );
}
