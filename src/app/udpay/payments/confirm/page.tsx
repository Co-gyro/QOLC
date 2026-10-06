import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import {
  chargeDateFor,
  computeTotals,
  effectiveChargeDate,
  payoutDateFor,
  todayJst,
} from "@/lib/udpay/logic";
import { confirmBlocker } from "@/lib/udpay/invoice-actions";
import { UdpayHeader } from "../../header";
import { ConfirmForm, type ConfirmCandidate } from "./confirm-form";

export const dynamic = "force-dynamic";

/**
 * 一括実行の確認画面（要望6）。
 * 課金予約の請求をすべて並べ、承認者が内容を確認して実行する。チェックを外した請求は対象外。
 * カード未登録・期限切れは対象にできない。予定日を過ぎた請求は翌日課金と表示する。
 */
export default async function UdpayConfirmPage() {
  const store = await loadStore();
  const today = todayJst();
  const candidates: ConfirmCandidate[] = store.invoices
    .filter((i) => i.status === "reserved")
    .map((inv) => {
      const customer = store.customers.find((c) => c.id === inv.customerId);
      const planned = chargeDateFor(inv.month, customer?.anniversaryDay ?? 1);
      const chargeDate = effectiveChargeDate(planned, today);
      return {
        invoiceId: inv.id,
        customerName: customer?.name ?? "—",
        month: inv.month,
        amount: computeTotals(inv.lines).total,
        plannedDate: planned,
        chargeDate,
        payoutDate: payoutDateFor(chargeDate),
        to: customer?.email ?? "",
        cc: customer?.cc ?? [],
        blocker: confirmBlocker(store, inv, today),
      };
    })
    .sort((a, b) => a.chargeDate.localeCompare(b.chargeDate));

  return (
    <div>
      <UdpayHeader />
      <main className="up-container">
        <p style={{ marginBottom: 8 }}>
          <Link href="/udpay/payments">← 入金管理へ戻る</Link>
        </p>
        <h1>一括実行の確認</h1>
        <p className="up-lead">
          内容を確認して実行してください。実行すると<strong>請求メールを一括送信し、各顧客の決済日に登録カードへ課金します</strong>。
          対象から外す請求はチェックを外してください。本番では承認権限のある方（作成者とは別の方）だけが実行できます。
        </p>
        {candidates.length === 0 ? (
          <p className="up-notice">
            課金予約の請求はありません。請求管理で「課金予約」すると、ここに表示されます。
          </p>
        ) : (
          <ConfirmForm candidates={candidates} />
        )}
      </main>
    </div>
  );
}
