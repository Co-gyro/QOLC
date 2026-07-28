import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import {
  computeTotals,
  formatDateJa,
  formatMonthJa,
  formatYen,
} from "@/lib/udpay/logic";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * 領収書（印刷用）。入金済みの決済に対して自動発行される。
 * 発行者はランサイド様名義（デモ）で、支払方法として登録カードのマスク表示を記載する。
 */
export default async function UdpayReceiptPage({
  params,
}: {
  params: { paymentId: string };
}) {
  const store = await loadStore();
  const payment = store.payments.find((p) => p.id === params.paymentId);
  const invoice = payment
    ? store.invoices.find((i) => i.id === payment.invoiceId)
    : undefined;
  const customer = payment
    ? store.customers.find((c) => c.id === payment.customerId)
    : undefined;

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

  const totals = computeTotals(invoice.lines);
  const paidDate = (payment.paidAt ?? payment.scheduledDate).slice(0, 10);

  return (
    <main className="up-container">
      <div
        className="up-no-print"
        style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 16 }}
      >
        <Link className="up-btn secondary" href="/udpay/payments">
          ← 入金管理へ戻る
        </Link>
        <PrintButton />
      </div>

      <div className="up-receipt">
        <h1>領収書</h1>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {customer.name} 御中
          </div>
          <div style={{ textAlign: "right", color: "var(--muted)", fontSize: 14 }}>
            発行日: {formatDateJa(paidDate)}
            <br />
            領収書番号: {payment.id.toUpperCase()}
          </div>
        </div>

        <div
          style={{
            border: "2px solid var(--navy)",
            borderRadius: 8,
            padding: "14px 20px",
            textAlign: "center",
            fontSize: 22,
            fontWeight: 800,
            marginBottom: 20,
          }}
        >
          {formatYen(payment.amount)} －（税込）
        </div>
        <p style={{ marginBottom: 20 }}>
          但し {formatMonthJa(invoice.month)}サービス分 サポート料金として、
          上記正に領収いたしました。
        </p>

        <table className="up-table" style={{ marginBottom: 20 }}>
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
              <td colSpan={3} className="num">小計（税抜）</td>
              <td className="num">{formatYen(totals.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="num">消費税（10%）</td>
              <td className="num">{formatYen(totals.tax)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="num" style={{ fontWeight: 700 }}>合計</td>
              <td className="num" style={{ fontWeight: 800 }}>{formatYen(payment.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <div style={{ color: "var(--muted)" }}>
            お支払方法: クレジットカード（{customer.card.brand}{" "}
            {customer.card.maskedNumber}）
            <br />
            決済日: {formatDateJa(paidDate)}
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>株式会社ランサイド</strong>
            <br />
            東京都千代田区有楽町2-7-1
            <br />
            <span style={{ color: "var(--muted)" }}>
              （決済処理: UD Payment ／ ユニバーサルデベロップメント株式会社）
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
