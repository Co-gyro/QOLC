import { headers } from "next/headers";
import { loadStore } from "@/lib/udpay/store";
import { UdpayHeader } from "../header";
import { CopyButton } from "../action-button";
import { NewCustomerForm } from "./new-customer-form";

export const dynamic = "force-dynamic";

/**
 * 顧客管理画面。
 * 顧客一覧・カード登録状況の確認と、カード登録リンクの発行（コピー）を行う。
 */
export default async function UdpayCustomersPage() {
  const store = await loadStore();
  const headerList = headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

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
            <h1>顧客管理</h1>
            <p className="up-lead">
              カード未登録の顧客には「登録リンクをコピー」してメールで送付してください。
              顧客自身がリンク先でカードを登録します（貴社がカード番号を扱うことはありません）。
            </p>
          </div>
          <NewCustomerForm />
        </div>

        <div className="up-table-wrap">
          <table className="up-table">
            <thead>
              <tr>
                <th>顧客名</th>
                <th>担当者</th>
                <th>課金日</th>
                <th>カード登録</th>
                <th>登録カード</th>
                <th>カード登録リンク</th>
              </tr>
            </thead>
            <tbody>
              {store.customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <div style={{ color: "var(--muted)", fontSize: 14 }}>{c.email}</div>
                  </td>
                  <td>{c.contactName} 先生</td>
                  <td>毎月{c.anniversaryDay}日</td>
                  <td>
                    {c.card.registered ? (
                      <span className="up-badge paid">登録済み</span>
                    ) : (
                      <span className="up-badge failed">未登録</span>
                    )}
                  </td>
                  <td>
                    {c.card.registered
                      ? `${c.card.brand} ${c.card.maskedNumber?.slice(-4) ? c.card.maskedNumber : ""}`
                      : "—"}
                  </td>
                  <td>
                    <CopyButton
                      text={`${baseUrl}/udpay/card/${c.registrationToken}`}
                      label="登録リンクをコピー"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
