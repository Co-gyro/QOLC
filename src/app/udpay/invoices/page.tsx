import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import {
  chargeDateFor,
  computeTotals,
  currentMonth,
  formatDateJa,
  formatMonthJa,
  formatYen,
  matchesKeyword,
} from "@/lib/udpay/logic";
import { DISPLAY_STATUS, displayStatusOf, parseStatusFilter } from "@/lib/udpay/status";
import { UdpayHeader } from "../header";
import { ActionButton } from "../action-button";
import { MonthTabs } from "../_components/month-tabs";
import { FilterBar } from "../_components/filter-bar";
import { StatusBadge, StatusLegend } from "../_components/status";
import { StatusSummary } from "../_components/status-summary";
import { CreateInvoiceButton } from "./create-invoice-button";
import { CsvImportDialog } from "./csv-import-dialog";

export const dynamic = "force-dynamic";

/** 請求管理の絞り込みで選べる状態 */
const FILTER_OPTIONS = (["none", "draft", "reserved", "confirmed", "paid", "failed"] as const).map(
  (s) => ({ value: s, label: DISPLAY_STATUS[s].label }),
);

/**
 * 請求管理画面（要望2・4）。
 * 月タブで月を切り替え、状態・顧客名で絞り込む。「直近の請求からコピー」で下書きを作り、
 * 変わった分だけ直して「課金予約」する（メールは承認者の一括実行時に送付）。
 */
export default async function UdpayInvoicesPage({
  searchParams,
}: {
  searchParams: { month?: string; status?: string; q?: string };
}) {
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? "")
    ? (searchParams.month as string)
    : currentMonth();
  const statusFilter = parseStatusFilter(searchParams.status);
  const store = await loadStore();
  const rows = store.customers
    .map((c) => {
      const inv = store.invoices.find((i) => i.month === month && i.customerId === c.id);
      const payment = inv ? store.payments.find((p) => p.invoiceId === inv.id) : undefined;
      return { c, inv, payment, status: displayStatusOf(inv, payment) };
    })
    .filter((r) => matchesKeyword(searchParams.q, [r.c.name, r.c.contactName, r.c.email]))
    .filter((r) => !statusFilter || r.status === statusFilter);
  const draftIds = rows.filter((r) => r.status === "draft" && r.inv).map((r) => r.inv!.id);
  const keep = { status: searchParams.status, q: searchParams.q };

  return (
    <div>
      <UdpayHeader />
      <main className="up-container">
        <h1>請求管理 — {formatMonthJa(month)}サービス分</h1>
        <p className="up-lead">
          「直近の請求からコピー」で下書きを作り、変わった分だけ直して「課金予約」してください。
          課金予約ではメールは送られません。メール送付と決済確定は、承認者が入金管理の「一括実行」で行います。
        </p>
        <MonthTabs basePath="/udpay/invoices" month={month} keep={keep} />
        <div className="up-actions" style={{ marginBottom: 12 }}>
          <ActionButton
            action="copyPreviousMonth"
            payload={{ month }}
            label="直近の請求からコピーして下書き作成"
          />
          <CsvImportDialog month={month} customerNames={store.customers.map((c) => c.name)} />
          {draftIds.length > 0 && (
            <ActionButton
              action="reserveInvoices"
              payload={{ invoiceIds: draftIds }}
              label={`表示中の下書き${draftIds.length}件をまとめて課金予約`}
              className="up-btn secondary"
              confirmMessage={`下書き${draftIds.length}件を課金予約にします（メールはまだ送られません）。よろしいですか？`}
            />
          )}
        </div>
        <FilterBar
          basePath="/udpay/invoices"
          q={searchParams.q}
          selectName="status"
          selectLabel="状態"
          selectValue={statusFilter ?? undefined}
          options={FILTER_OPTIONS}
          hidden={{ month }}
          placeholder="医院名・担当者名・メール"
        />
        <StatusLegend />
        <StatusSummary rows={rows.map((r) => ({ status: r.status, amount: r.inv ? computeTotals(r.inv.lines).total : 0 }))} />

        <div className="up-table-wrap">
          <table className="up-table">
            <thead>
              <tr>
                <th>顧客名</th>
                <th>状態</th>
                <th className="num">請求金額（税込）</th>
                <th>決済日</th>
                <th>メール</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, inv, payment, status }) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    {!c.card.registered && <div style={{ color: "var(--red)" }}>カード未登録</div>}
                  </td>
                  <td>
                    <StatusBadge status={status} />
                  </td>
                  <td className="num">{inv ? formatYen(computeTotals(inv.lines).total) : "—"}</td>
                  <td>
                    {formatDateJa(payment?.scheduledDate ?? chargeDateFor(month, c.anniversaryDay))}
                    <div className="up-muted">毎月{c.anniversaryDay}日</div>
                  </td>
                  <td>{inv?.mailSentAt ? "送付済み" : "未送付"}</td>
                  <td>
                    {inv ? (
                      <Link className="up-btn secondary small" href={`/udpay/invoices/${inv.id}`}>
                        {status === "draft" ? "編集" : "表示"}
                      </Link>
                    ) : (
                      <CreateInvoiceButton customerId={c.id} month={month} />
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="up-muted">条件に合う請求はありません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
