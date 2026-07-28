import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import {
  chargeDateFor,
  computeTotals,
  currentMonth,
  formatDateJa,
  formatMonthJa,
  formatYen,
  previousMonth,
} from "@/lib/udpay/logic";
import { UdpayHeader } from "../header";
import { ActionButton } from "../action-button";
import { CreateInvoiceButton } from "./create-invoice-button";

export const dynamic = "force-dynamic";

/**
 * 請求管理画面。
 * 月を選んで顧客ごとの請求状況を一覧し、「前月分をコピー」から当月の請求作成を始める。
 */
export default async function UdpayInvoicesPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? "")
    ? (searchParams.month as string)
    : currentMonth();
  const store = await loadStore();
  const monthInvoices = store.invoices.filter((i) => i.month === month);
  const draftCount = monthInvoices.filter((i) => i.status === "draft").length;

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
            <h1>請求管理 — {formatMonthJa(month)}サービス分</h1>
            <p className="up-lead">
              「前月分をコピー」で下書きを作り、変わった分（交通費・オプション）だけ
              修正して確定してください。確定と同時に請求明細メールが送付され、
              各顧客の課金日に自動課金されます。
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              className="up-btn secondary small"
              href={`/udpay/invoices?month=${previousMonth(month)}`}
            >
              ← 前月
            </Link>
            {month !== currentMonth() && (
              <Link className="up-btn secondary small" href="/udpay/invoices">
                今月へ
              </Link>
            )}
            <ActionButton
              action="copyPreviousMonth"
              payload={{ month }}
              label="前月分をコピーして下書き作成"
            />
          </div>
        </div>

        {draftCount > 0 && (
          <p className="up-notice">
            下書きが{draftCount}件あります。内容を確認して確定してください。
          </p>
        )}

        <div className="up-table-wrap">
          <table className="up-table">
            <thead>
              <tr>
                <th>顧客名</th>
                <th>状態</th>
                <th className="num">請求金額（税込）</th>
                <th>課金予定日</th>
                <th>メール送付</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {store.customers.map((c) => {
                const inv = monthInvoices.find((i) => i.customerId === c.id);
                const totals = inv ? computeTotals(inv.lines) : null;
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      {!c.card.registered && (
                        <div style={{ color: "var(--red)", fontSize: 14 }}>
                          カード未登録
                        </div>
                      )}
                    </td>
                    <td>
                      {!inv ? (
                        <span className="up-badge none">未作成</span>
                      ) : inv.status === "draft" ? (
                        <span className="up-badge draft">下書き</span>
                      ) : (
                        <span className="up-badge confirmed">確定済み</span>
                      )}
                    </td>
                    <td className="num">
                      {totals ? formatYen(totals.total) : "—"}
                    </td>
                    <td>
                      {inv?.status === "confirmed"
                        ? formatDateJa(chargeDateFor(month, c.anniversaryDay))
                        : `毎月${c.anniversaryDay}日`}
                    </td>
                    <td>
                      {inv?.mailSentAt ? (
                        <span className="up-badge paid">送付済み</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {inv ? (
                        <Link
                          className="up-btn secondary small"
                          href={`/udpay/invoices/${inv.id}`}
                        >
                          {inv.status === "draft" ? "編集・確定" : "表示"}
                        </Link>
                      ) : (
                        <CreateInvoiceButton customerId={c.id} month={month} />
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
