import { headers } from "next/headers";
import { loadStore } from "@/lib/udpay/store";
import { formatDateJa, matchesKeyword, todayJst } from "@/lib/udpay/logic";
import { cardExpiryStatus } from "@/lib/payment/card-expiry";
import type { UdpayCustomer } from "@/lib/udpay/types";
import { UdpayHeader } from "../header";
import { ActionButton, CopyButton } from "../action-button";
import { FilterBar } from "../_components/filter-bar";
import { CardSummary } from "../_components/status";
import { NewCustomerForm } from "./new-customer-form";

export const dynamic = "force-dynamic";

/** カードの絞り込み */
const CARD_FILTERS = [
  { value: "registered", label: "カード登録済み" },
  { value: "unregistered", label: "カード未登録" },
  { value: "expiring", label: "有効期限が近い" },
  { value: "expired", label: "有効期限切れ" },
];

/** 顧客がカードの絞り込みに合うか */
function matchesCard(c: UdpayCustomer, filter: string | undefined, today: string): boolean {
  if (!filter) return true;
  if (filter === "registered") return c.card.registered;
  if (filter === "unregistered") return !c.card.registered;
  return c.card.registered && cardExpiryStatus(c.card.expireYm, today) === filter;
}

/**
 * 顧客管理画面（要望3）。
 * 検索・カードの絞り込み、宛先（To/CC）・決済日・備考の確認、カード登録リンクの「コピー」「メールで送る」。
 * 有効期限が近い・切れた顧客には印を付ける（本番では更新のご案内メールを自動送付）。
 */
export default async function UdpayCustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; card?: string };
}) {
  const store = await loadStore();
  const today = todayJst();
  const host = headers().get("host") ?? "localhost:3000";
  const proto = headers().get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;
  const card = CARD_FILTERS.some((f) => f.value === searchParams.card) ? searchParams.card : undefined;
  const rows = store.customers
    .filter((c) => matchesKeyword(searchParams.q, [c.name, c.contactName, c.email, ...c.cc]))
    .filter((c) => matchesCard(c, card, today));
  const needsAttention = store.customers.filter(
    (c) => c.card.registered && ["expiring", "expired"].includes(cardExpiryStatus(c.card.expireYm, today)),
  ).length;

  return (
    <div>
      <UdpayHeader />
      <main className="up-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1>顧客管理</h1>
            <p className="up-lead">
              カード未登録の顧客には登録リンクを送ってください。顧客自身がリンク先でカードを登録します
              （貴社・UDともにカード番号は扱いません）。
            </p>
          </div>
          <NewCustomerForm />
        </div>
        {needsAttention > 0 && (
          <p className="up-notice">
            有効期限が近い・切れたカードが{needsAttention}件あります。本番では顧客へカード更新のご案内メール
            （登録リンク付き）が自動で送られます。
          </p>
        )}
        <FilterBar
          basePath="/udpay/customers"
          q={searchParams.q}
          selectName="card"
          selectLabel="カード"
          selectValue={card}
          options={CARD_FILTERS}
          placeholder="医院名・担当者名・メール"
        />
        <p className="up-muted">{rows.length}件を表示</p>
        <div className="up-table-wrap">
          <table className="up-table">
            <thead>
              <tr>
                <th>顧客名・備考</th>
                <th>宛先（To / CC）</th>
                <th>決済日</th>
                <th>登録カード</th>
                <th>カード登録リンク</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <div>{c.contactName} 先生</div>
                    {c.note && <div className="up-muted">備考: {c.note}</div>}
                  </td>
                  <td>
                    <div>To: {c.email}</div>
                    {c.cc.map((m) => (
                      <div key={m} className="up-muted">CC: {m}</div>
                    ))}
                  </td>
                  <td>毎月{c.anniversaryDay}日</td>
                  <td>
                    <CardSummary card={c.card} today={today} />
                  </td>
                  <td>
                    <div className="up-actions">
                      <CopyButton text={`${baseUrl}/udpay/card/${c.registrationToken}`} label="コピー" />
                      <ActionButton
                        action="sendRegistrationMail"
                        payload={{ customerId: c.id }}
                        label="メールで送る"
                        className="up-btn secondary small"
                        confirmMessage={`${c.email} へカード登録のご案内を送ります（デモのため実際には送信されません）。`}
                      />
                    </div>
                    {c.registrationMailSentAt && (
                      <div className="up-muted">送付: {formatDateJa(c.registrationMailSentAt.slice(0, 10))}</div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="up-muted">条件に合う顧客はいません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
