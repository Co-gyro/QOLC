import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import { formatDateJa, formatMonthJa, formatYen } from "@/lib/udpay/logic";
import { UdpayHeader } from "../header";
import { ActionButton } from "../action-button";

export const dynamic = "force-dynamic";

/**
 * 入金管理画面（消込）。
 * 課金予約・入金済み・与信落ちを一覧し、課金バッチの実行（デモ）と再決済を行う。
 */
export default async function UdpayPaymentsPage() {
  const store = await loadStore();
  const payments = [...store.payments].sort((a, b) =>
    (b.scheduledDate + b.id).localeCompare(a.scheduledDate + a.id),
  );
  const scheduled = payments.filter((p) => p.status === "scheduled");
  const failed = payments.filter((p) => p.status === "failed");

  return (
    <div>
      <UdpayHeader />
      <main className="up-container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1>入金管理</h1>
            <p className="up-lead">
              実運用では各顧客の課金日に自動で課金されます。デモでは「課金バッチを実行」で
              予定日を待たずに課金を再現できます。
            </p>
          </div>
          <ActionButton
            action="runChargeBatch"
            label={`課金バッチを実行（予約中 ${scheduled.length}件）`}
            confirmMessage="課金予約中の決済をすべて実行します（デモ・実課金なし）。よろしいですか？"
          />
        </div>

        {failed.length > 0 && (
          <p className="up-error">
            与信落ちが{failed.length}件あります。カード会社の承認が得られませんでした
            （do_not_honor）。顧客へ確認のうえ「再決済」を実行してください。
            実運用では担当者へ自動通知され、顧客へも再決済のご案内メールが送られます。
          </p>
        )}

        <div className="up-table-wrap">
          <table className="up-table">
            <thead>
              <tr>
                <th>顧客名</th>
                <th>対象月</th>
                <th className="num">金額（税込）</th>
                <th>課金予定日</th>
                <th>状態</th>
                <th>試行</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const customer = store.customers.find((c) => c.id === p.customerId);
                const invoice = store.invoices.find((i) => i.id === p.invoiceId);
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{customer?.name ?? "—"}</strong>
                      <div style={{ color: "var(--muted)", fontSize: 14 }}>
                        {customer?.card.brand} {customer?.card.maskedNumber}
                      </div>
                    </td>
                    <td>{invoice ? formatMonthJa(invoice.month) : "—"}</td>
                    <td className="num">{formatYen(p.amount)}</td>
                    <td>{formatDateJa(p.scheduledDate)}</td>
                    <td>
                      {p.status === "paid" && <span className="up-badge paid">入金済み</span>}
                      {p.status === "failed" && <span className="up-badge failed">与信落ち</span>}
                      {p.status === "scheduled" && (
                        <span className="up-badge scheduled">課金予約中</span>
                      )}
                    </td>
                    <td>
                      {p.attempts.length === 0
                        ? "—"
                        : `${p.attempts.length}回${
                            p.attempts.some((a) => a.result === "failed")
                              ? "（失敗あり）"
                              : ""
                          }`}
                    </td>
                    <td style={{ display: "flex", gap: 8 }}>
                      {p.status === "failed" && (
                        <ActionButton
                          action="retryPayment"
                          payload={{ paymentId: p.id }}
                          label="再決済"
                          className="up-btn small"
                        />
                      )}
                      {p.status === "paid" && (
                        <Link
                          className="up-btn secondary small"
                          href={`/udpay/receipts/${p.id}`}
                        >
                          領収書
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
