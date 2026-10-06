import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import {
  canCancelConfirmation,
  chargeDateFor,
  computeTotals,
  currentMonth,
  formatDateJa,
  formatMonthJa,
  formatYen,
  matchesKeyword,
  todayJst,
} from "@/lib/udpay/logic";
import {
  DISPLAY_STATUS,
  displayStatusOf,
  parseStatusFilter,
} from "@/lib/udpay/status";
import { UdpayHeader } from "../header";
import { ActionButton } from "../action-button";
import { MonthTabs } from "../_components/month-tabs";
import { FilterBar } from "../_components/filter-bar";
import { StatusBadge, StatusLegendToggle } from "../_components/status";
import { StatusSummary } from "../_components/status-summary";
import { RowActions } from "./row-actions";

export const dynamic = "force-dynamic";

/** 入金管理の絞り込みで選べる状態 */
const FILTER_OPTIONS = (
  ["reserved", "confirmed", "paid", "failed"] as const
).map((s) => ({
  value: s,
  label: DISPLAY_STATUS[s].label,
}));

/**
 * 入金管理画面（要望1・6・7）。
 * 月タブ（サービス提供月）と状態・顧客名で絞り込み、課金予約〜入金済みを一覧する。
 * 「一括実行」で確認画面へ進み、承認者がメール送付と決済確定をまとめて行う。
 */
export default async function UdpayPaymentsPage({
  searchParams,
}: {
  searchParams: { month?: string; status?: string; q?: string; done?: string };
}) {
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? "")
    ? (searchParams.month as string)
    : currentMonth();
  const statusFilter = parseStatusFilter(searchParams.status);
  const today = todayJst();
  const store = await loadStore();
  const allReserved = store.invoices.filter(
    (i) => i.status === "reserved",
  ).length;
  const rows = store.invoices
    .filter((i) => i.month === month && i.status !== "draft")
    .map((inv) => {
      const customer = store.customers.find((c) => c.id === inv.customerId);
      const payment = store.payments.find((p) => p.invoiceId === inv.id);
      return { inv, customer, payment, status: displayStatusOf(inv, payment) };
    })
    .filter((r) =>
      matchesKeyword(searchParams.q, [
        r.customer?.name,
        r.customer?.contactName,
        r.customer?.email,
      ]),
    )
    .filter((r) => !statusFilter || r.status === statusFilter)
    .sort(
      (a, b) =>
        (a.customer?.anniversaryDay ?? 0) - (b.customer?.anniversaryDay ?? 0),
    );
  const failedCount = rows.filter((r) => r.status === "failed").length;

  return (
    <div>
      <UdpayHeader />
      <main className="up-container">
        <h1>入金管理 — {formatMonthJa(month)}サービス分</h1>
        <p className="up-lead">
          決済確定した請求は、各顧客の決済日に自動で課金されます。課金予約の請求は、承認者の「一括実行」で
          メール送付・決済確定されます。
        </p>
        <div className="up-actions" style={{ marginBottom: 12 }}>
          <Link className="up-btn" href="/udpay/payments/confirm">
            一括実行（課金予約 {allReserved}件）
          </Link>
          <ActionButton
            action="runChargeBatch"
            label="自動課金をいま実行（デモ）"
            className="up-btn secondary"
            confirmMessage="決済確定済みの請求を、決済日を待たずに課金します（デモ・実課金なし）。よろしいですか？"
          />
        </div>
        {searchParams.done && <p className="up-notice">{searchParams.done}</p>}
        {failedCount > 0 && (
          <p className="up-error">
            与信落ちが{failedCount}
            件あります。顧客へ連絡のうえ「再決済」してください。カードを変える場合は、
            顧客管理から登録リンクを送ってください（担当者には実運用でメール通知されます）。
          </p>
        )}
        <FilterBar
          basePath="/udpay/payments"
          q={searchParams.q}
          selectName="status"
          selectLabel="状態"
          selectValue={statusFilter ?? undefined}
          options={FILTER_OPTIONS}
          hidden={{ month }}
          placeholder="医院名・担当者名・メール"
        />
        <div className="up-listbar">
          <StatusSummary
            rows={rows.map((r) => ({
              status: r.status,
              amount: computeTotals(r.inv.lines).total,
            }))}
          />
          <StatusLegendToggle />
        </div>

        <div className="up-tabbed">
          <MonthTabs
            basePath="/udpay/payments"
            month={month}
            keep={{ status: searchParams.status, q: searchParams.q }}
          />

          <div className="up-table-wrap">
            <table className="up-table">
              <thead>
                <tr>
                  <th>顧客名</th>
                  <th className="num">金額（税込）</th>
                  <th>決済日</th>
                  <th>状態</th>
                  <th>試行</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ inv, customer, payment, status }) => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{customer?.name ?? "—"}</strong>
                      <div className="up-muted">
                        {customer?.card.brand} {customer?.card.maskedNumber}
                      </div>
                    </td>
                    <td className="num">
                      {formatYen(
                        payment?.amount ?? computeTotals(inv.lines).total,
                      )}
                    </td>
                    <td>
                      {formatDateJa(
                        payment?.scheduledDate ??
                          chargeDateFor(
                            inv.month,
                            customer?.anniversaryDay ?? 1,
                          ),
                      )}
                    </td>
                    <td>
                      <StatusBadge status={status} />
                    </td>
                    <td>
                      {!payment || payment.attempts.length === 0
                        ? "—"
                        : `${payment.attempts.length}回${payment.attempts.some((a) => a.result === "failed") ? "（失敗あり）" : ""}`}
                    </td>
                    <td>
                      <RowActions
                        invoiceId={inv.id}
                        paymentId={payment?.id}
                        status={status}
                        cancellable={
                          !!payment &&
                          canCancelConfirmation(payment.scheduledDate, today)
                        }
                      />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="up-muted">
                      この月の課金予約・決済はありません（請求管理で課金予約すると表示されます）。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
