"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProdCustomer } from "@/lib/udpay/prod/customers";
import { udpayAdminFetch } from "./api";
import { ContactsEditor, type ContactDraft } from "./contacts-editor";

/**
 * UD Payment 顧客の登録・編集フォーム（UD管理画面）。
 * 決済日は加盟店で決めた候補（ランサイド様は 15日・28日）から選ぶ。カード情報は編集できない。
 */
export function UdpayCustomerForm(props: {
  merchantId: string;
  merchantName: string;
  chargeDays: number[];
  initial?: ProdCustomer;
}) {
  const router = useRouter();
  const init = props.initial;
  const [form, setForm] = useState({
    name: init?.name ?? "",
    contactName: init?.contactName ?? "",
    chargeDay: init?.chargeDay ?? props.chargeDays[0] ?? 15,
    postalCode: init?.postalCode ?? "",
    address1: init?.address1 ?? "",
    address2: init?.address2 ?? "",
    billingNote: init?.billingNote ?? "",
    internalMemo: init?.internalMemo ?? "",
  });
  const [contacts, setContacts] = useState<ContactDraft[]>(
    init?.contacts.length
      ? init.contacts.map((c) => ({ kind: c.kind, name: c.name ?? "", email: c.email }))
      : [{ kind: "to", name: "", email: "" }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = Array.from(new Set([...props.chargeDays, ...(init?.chargeDay ? [init.chargeDay] : [])])).sort((a, b) => a - b);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: k === "chargeDay" ? Number(e.target.value) : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { ...form, contacts: contacts.filter((c) => c.email.trim()) };
    try {
      if (init) {
        await udpayAdminFetch(`/api/admin/udpay/customers/${init.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await udpayAdminFetch("/api/admin/udpay/customers", {
          method: "POST",
          body: JSON.stringify({ ...body, merchantId: props.merchantId }),
        });
      }
      router.push("/admin/udpay");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 block min-h-[44px] w-full rounded border border-[#E0DDD8] px-3";
  const label = "block text-sm font-bold";
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4 rounded border border-[#E0DDD8] bg-white p-5">
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>加盟店: {props.merchantName}</p>
      {error && <p className="rounded bg-[#FEE2E2] p-3 text-[#991B1B]">{error}</p>}
      <label className={label}>
        医院名・会社名（必須）
        <input className={field} required maxLength={100} value={form.name} onChange={set("name")} placeholder="例: 医療法人社団〇〇会　こだま歯科クリニック" />
        <span className="font-normal" style={{ color: "var(--qolc-muted)" }}>法人名と医院名の間に空白を入れると、請求書・領収証でその位置で改行します。</span>
      </label>
      <label className={label}>
        担当者名
        <input className={field} maxLength={50} value={form.contactName} onChange={set("contactName")} placeholder="例: 児玉" />
      </label>
      <div>
        <p className={label}>メールの宛先（請求メール・カード登録のご案内）</p>
        <ContactsEditor value={contacts} onChange={setContacts} />
      </div>
      <label className={label}>
        毎月の決済日
        <select className={field} value={form.chargeDay} onChange={set("chargeDay")}>
          {days.map((d) => (
            <option key={d} value={d}>毎月{d}日</option>
          ))}
        </select>
      </label>
      <fieldset className="space-y-2">
        <legend className={label}>住所（領収証の宛先・任意）</legend>
        <input className={field} aria-label="郵便番号" value={form.postalCode} onChange={set("postalCode")} placeholder="郵便番号 例: 150-0001" />
        <input className={field} aria-label="住所1行目" value={form.address1} onChange={set("address1")} placeholder="例: 東京都渋谷区神宮前1-2-3" />
        <input className={field} aria-label="住所2行目" value={form.address2} onChange={set("address2")} placeholder="建物名など" />
      </fieldset>
      <label className={label}>
        請求書の備考（請求書に印字されます）
        <input className={field} value={form.billingNote} onChange={set("billingNote")} />
      </label>
      <label className={label}>
        社内メモ（印字されません）
        <input className={field} value={form.internalMemo} onChange={set("internalMemo")} />
      </label>
      {init && (
        <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
          登録カードと登録リンクは変わりません。宛先・担当者名の変更は次のメールから、決済日の変更はこれから決済確定する請求から反映されます。
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="min-h-[44px] rounded bg-[#4C986A] px-5 font-bold text-white hover:bg-[#3D7A55] disabled:opacity-50">
          {busy ? "保存中…" : init ? "保存する" : "登録する"}
        </button>
        <button type="button" onClick={() => router.push("/admin/udpay")} className="min-h-[44px] rounded border border-[#E0DDD8] px-5">
          キャンセル
        </button>
      </div>
    </form>
  );
}
