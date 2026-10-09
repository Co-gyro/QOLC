"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cardExpiryStatus, CARD_EXPIRY_LABELS, formatExpireYm } from "@/lib/payment/card-expiry";
import type { ProdCustomer } from "@/lib/udpay/prod/customers";
import type { UdpayMerchant } from "@/lib/udpay/prod/merchants";
import { udpayAdminFetch } from "./api";
import { RegistrationLinkActions } from "./registration-link-actions";

/** 今日（日本時間 YYYY-MM-DD） */
function todayJst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/**
 * UD Payment 加盟店の顧客一覧（UD管理画面）。
 * カード登録状況・有効期限・宛先を確認し、カード登録リンクのコピー／メール送付、顧客の追加・編集を行う。
 */
export function UdpayCustomerList() {
  const [merchants, setMerchants] = useState<UdpayMerchant[]>([]);
  const [merchantId, setMerchantId] = useState("");
  const [customers, setCustomers] = useState<ProdCustomer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayJst();

  useEffect(() => {
    udpayAdminFetch<UdpayMerchant[]>("/api/admin/udpay/merchants")
      .then((list) => {
        setMerchants(list);
        if (list[0]) setMerchantId(list[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!merchantId) return;
    setCustomers(null);
    udpayAdminFetch<ProdCustomer[]>(`/api/admin/udpay/customers?merchantId=${merchantId}`)
      .then(setCustomers)
      .catch((e: Error) => setError(e.message));
  }, [merchantId]);

  const registered = customers?.filter((c) => c.usenMemberId).length ?? 0;

  return (
    <div className="space-y-4">
      {error && <p className="rounded bg-[#FEE2E2] p-3 text-[#991B1B]">{error}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-bold">
          加盟店
          <select
            className="mt-1 block min-h-[44px] rounded border border-[#E0DDD8] px-3"
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
          >
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}（{m.mallCode ?? "モール未設定"}）
              </option>
            ))}
          </select>
        </label>
        {merchantId && (
          <Link
            href={`/admin/udpay/customers/new?merchantId=${merchantId}`}
            className="inline-flex min-h-[44px] items-center rounded bg-[#4C986A] px-4 font-bold text-white hover:bg-[#3D7A55]"
          >
            ＋ 顧客を追加
          </Link>
        )}
        {customers && (
          <span className="text-sm" style={{ color: "var(--qolc-muted)" }}>
            顧客 {customers.length}件（カード登録済み {registered}件）
          </span>
        )}
      </div>

      {customers === null ? (
        <p>読み込み中…</p>
      ) : customers.length === 0 ? (
        <p className="rounded border border-dashed border-[#E0DDD8] p-6 text-center">
          顧客はまだ登録されていません。「＋ 顧客を追加」から登録してください。
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-[#E0DDD8] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E0DDD8] bg-[#F0F9F4]">
              <tr>
                <th className="p-3">顧客名</th>
                <th className="p-3">宛先（To / CC）</th>
                <th className="p-3">決済日</th>
                <th className="p-3">カード</th>
                <th className="p-3">カード登録リンク</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const status = cardExpiryStatus(c.cardExpireYm, today);
                return (
                  <tr key={c.id} className="border-b border-[#E0DDD8] align-top last:border-0">
                    <td className="p-3">
                      <div className="font-bold">{c.name}</div>
                      {c.contactName && <div>{c.contactName} 様</div>}
                      <Link href={`/admin/udpay/customers/${c.id}`} className="mt-1 inline-block text-[#3D7A55] underline">
                        編集
                      </Link>
                    </td>
                    <td className="p-3">
                      {c.contacts.map((m) => (
                        <div key={`${m.kind}-${m.email}`}>
                          {m.kind === "to" ? "To" : "CC"}: {m.email}
                        </div>
                      ))}
                    </td>
                    <td className="p-3">{c.chargeDay ? `毎月${c.chargeDay}日` : "—"}</td>
                    <td className="p-3">
                      {c.usenMemberId ? (
                        <>
                          <div>
                            {c.cardBrand ?? "登録済み"}
                            {c.cardLast4 ? ` 下4桁 ${c.cardLast4}` : ""}
                          </div>
                          <div style={{ color: "var(--qolc-muted)" }}>
                            有効期限 {formatExpireYm(c.cardExpireYm)}
                            {(status === "expiring" || status === "expired") && (
                              <span className="ml-1 rounded bg-[#FEF4E2] px-2 font-bold text-[#B45309]">
                                {CARD_EXPIRY_LABELS[status]}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="rounded bg-[#FEE2E2] px-2 py-0.5 font-bold text-[#991B1B]">未登録</span>
                      )}
                    </td>
                    <td className="p-3">
                      <RegistrationLinkActions customerId={c.id} token={c.registrationToken} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
