"use client";

import { DEMO_MERCHANT } from "@/lib/udpay/merchant-profile";
import type { UdpayCustomer } from "@/lib/udpay/types";

/** 顧客フォームの初期値（編集時は登録内容） */
export type CustomerFieldValues = Pick<
  UdpayCustomer,
  "name" | "contactName" | "email" | "cc" | "anniversaryDay" | "note" | "postalCode" | "address1" | "address2"
>;

/** フォームの入力値を API に送る形にする（CC はカンマ・読点・空白区切り） */
export function customerPayload(form: FormData) {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  return {
    name: text("name"),
    contactName: text("contactName"),
    email: text("email"),
    cc: text("cc")
      .split(/[,、\s]+/)
      .map((m) => m.trim())
      .filter(Boolean),
    anniversaryDay: Number(form.get("anniversaryDay") ?? DEMO_MERCHANT.chargeDays[0]),
    note: text("note") || undefined,
    postalCode: text("postalCode") || undefined,
    address1: text("address1") || undefined,
    address2: text("address2") || undefined,
  };
}

/**
 * 顧客の入力欄（新規追加・編集で共通）。
 * 決済日は加盟店で決めた日（ランサイド様は 15日・28日）から選ぶ。
 */
export function CustomerFields({ initial }: { initial?: CustomerFieldValues }) {
  const days = Array.from(
    new Set([...DEMO_MERCHANT.chargeDays, ...(initial ? [initial.anniversaryDay] : [])]),
  ).sort((a, b) => a - b);
  return (
    <>
      <div className="up-field">
        <label htmlFor="up-name">医院名・会社名</label>
        <input id="up-name" name="name" required defaultValue={initial?.name} placeholder="例: 医療法人社団〇〇会　こだま歯科クリニック" />
        <div className="up-muted">法人名と医院名の間に空白を入れると、請求書・領収証でその位置で改行します。</div>
      </div>
      <div className="up-field">
        <label htmlFor="up-contact">担当者名</label>
        <input id="up-contact" name="contactName" required defaultValue={initial?.contactName} placeholder="例: 児玉" />
      </div>
      <div className="up-field">
        <label htmlFor="up-email">請求メールの宛先（To）</label>
        <input id="up-email" name="email" type="email" required defaultValue={initial?.email} placeholder="例: info@example.com" />
      </div>
      <div className="up-field">
        <label htmlFor="up-cc">CC（複数はカンマ区切り）</label>
        <input id="up-cc" name="cc" defaultValue={initial?.cc.join(", ")} placeholder="例: keiri@example.com, jimu@example.com" />
      </div>
      <div className="up-field">
        <label htmlFor="up-day">毎月の決済日</label>
        <select id="up-day" name="anniversaryDay" defaultValue={initial?.anniversaryDay ?? days[0]}>
          {days.map((d) => (
            <option key={d} value={d}>
              毎月{d}日
            </option>
          ))}
        </select>
      </div>
      <div className="up-field">
        <label htmlFor="up-postal">住所（領収証の宛先に記載・任意）</label>
        <input id="up-postal" name="postalCode" defaultValue={initial?.postalCode} placeholder="郵便番号 例: 150-0001" style={{ marginBottom: 6 }} />
        <input name="address1" aria-label="住所1行目" defaultValue={initial?.address1} placeholder="例: 東京都渋谷区神宮前1-2-3" style={{ marginBottom: 6 }} />
        <input name="address2" aria-label="住所2行目" defaultValue={initial?.address2} placeholder="建物名など（任意）" />
      </div>
      <div className="up-field">
        <label htmlFor="up-note">備考（社内向け・請求書には載りません）</label>
        <input id="up-note" name="note" defaultValue={initial?.note} placeholder="例: 請求書は院長と経理の両方へ" />
      </div>
    </>
  );
}
