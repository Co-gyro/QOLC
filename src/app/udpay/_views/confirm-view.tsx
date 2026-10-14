import Link from "next/link";
import { loadView } from "@/lib/udpay/view-source";
import { udpayPaths, type UdpayMode } from "@/lib/udpay/mode";
import { NoAccess } from "./no-access";
import {
  chargeDateFor,
  computeTotals,
  effectiveChargeDate,
  payoutDateFor,
  todayJst,
} from "@/lib/udpay/logic";
import { confirmBlocker } from "@/lib/udpay/invoice-actions";
import { UdpayHeader } from "../header";
import { ConfirmForm, type ConfirmCandidate } from "../payments/confirm/confirm-form";


/**
 * 一括実行の確認画面（要望6）。
 * 課金予約の請求をすべて並べ、承認者が内容を確認して実行する。チェックを外した請求は対象外。
 * カード未登録・期限切れは対象にできない。予定日を過ぎた請求は翌日課金と表示する。
 */
export async function ConfirmView({ mode }: { mode: UdpayMode }) {
  const view = await loadView(mode);
  if (!view.ok) return <NoAccess />;
  const { store, member } = view;
  const { base } = udpayPaths(mode);
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
        blocker:
          confirmBlocker(store, inv, today) ??
          (member && inv.reservedBy === member.userId ? "課金予約した本人は実行できません" : null),
      };
    })
    .sort((a, b) => a.chargeDate.localeCompare(b.chargeDate));

  return (
    <div>
      <UdpayHeader memberName={member?.displayName} />
      <main className="up-container">
        <p style={{ marginBottom: 8 }}>
          <Link href={`${base}/payments`}>← 入金管理へ戻る</Link>
        </p>
        <h1>一括実行の確認</h1>
        <p className="up-lead">
          内容を確認して実行してください。実行すると<strong>請求メールを一括送信し、各顧客の決済日に登録カードへ課金します</strong>。
          対象から外す請求はチェックを外してください。{mode === "demo" ? "本番では" : ""}承認権限のある方（課金予約した方とは別の方）だけが実行できます。
        </p>
        {member && !member.isApprover ? (
          <p className="up-notice">一括実行は承認者が行います。課金予約までお済みでしたら、承認者へご連絡ください。</p>
        ) : candidates.length === 0 ? (
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
