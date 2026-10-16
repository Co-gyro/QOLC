"use client";

import { useCallback, useEffect, useState } from "react";
import type { MemberRow } from "@/lib/udpay/prod/members-admin";
import type { UdpayMerchant } from "@/lib/udpay/prod/merchants";
import { udpayAdminFetch } from "./api";

/**
 * UD Payment 利用者（加盟店の担当者・承認者）の一覧と発行（UD管理画面）。
 * 発行すると招待メール（パスワード設定リンク）が届く。メールが届かない場合に備え、リンクも画面に出す。
 */
export function UdpayMemberList() {
  const [merchants, setMerchants] = useState<UdpayMerchant[]>([]);
  const [merchantId, setMerchantId] = useState("");
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [form, setForm] = useState({ displayName: "", email: "", isApprover: false });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; link?: string } | null>(null);

  useEffect(() => {
    udpayAdminFetch<UdpayMerchant[]>("/api/admin/udpay/merchants")
      .then((list) => {
        setMerchants(list);
        if (list[0]) setMerchantId(list[0].id);
      })
      .catch((e: Error) => setResult({ ok: false, text: e.message }));
  }, []);
  const load = useCallback(() => {
    if (!merchantId) return;
    udpayAdminFetch<MemberRow[]>(`/api/admin/udpay/members?merchantId=${merchantId}`).then(setRows).catch((e: Error) => setResult({ ok: false, text: e.message }));
  }, [merchantId]);
  useEffect(load, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const r = await udpayAdminFetch<{ inviteUrl: string; emailSent: boolean }>("/api/admin/udpay/members", {
        method: "POST",
        body: JSON.stringify({ merchantId, ...form }),
      });
      setResult({
        ok: true,
        text: r.emailSent ? `${form.email} へ招待メールを送りました。` : "招待メールを送れませんでした。下のリンクを別の方法でお送りください。",
        link: r.inviteUrl,
      });
      setForm({ displayName: "", email: "", isApprover: false });
      load();
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "発行に失敗しました" });
    } finally {
      setBusy(false);
    }
  }

  async function change(row: MemberRow, patch: { isApprover?: boolean; deactivate?: true }) {
    const msg = patch.deactivate
      ? `${row.displayName} さんの利用を停止します（ログインできなくなります）。よろしいですか？`
      : `${row.displayName} さんを${patch.isApprover ? "承認者" : "担当者"}にします。よろしいですか？`;
    if (!confirm(msg)) return;
    try {
      await udpayAdminFetch(`/api/admin/udpay/members/${row.userId}`, { method: "PATCH", body: JSON.stringify({ merchantId, ...patch }) });
      load();
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "更新に失敗しました" });
    }
  }

  const field = "mt-1 block min-h-[44px] w-full rounded border border-[#E0DDD8] px-3";
  const btn = "min-h-[44px] rounded border border-[#E0DDD8] bg-white px-3 font-bold hover:bg-[#F0F9F4]";
  return (
    <div className="space-y-4">
      <label className="text-sm font-bold">
        加盟店
        <select className="mt-1 block min-h-[44px] rounded border border-[#E0DDD8] px-3" value={merchantId} onChange={(e) => setMerchantId(e.target.value)}>
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>{m.name}（{m.mallCode ?? "—"}）</option>
          ))}
        </select>
      </label>
      {result && (
        <div className={`rounded p-3 ${result.ok ? "bg-[#F0F9F4]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
          <p>{result.text}</p>
          {result.link && (
            <p className="mt-1 break-all text-sm">
              招待リンク（24時間有効）: {result.link}
              <button type="button" className={`${btn} ml-2`} onClick={() => navigator.clipboard.writeText(result.link ?? "")}>コピー</button>
            </p>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded border border-[#E0DDD8] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#E0DDD8] bg-[#F0F9F4]">
            <tr><th className="p-3">氏名</th><th className="p-3">メール</th><th className="p-3">権限</th><th className="p-3">状態</th><th className="p-3">操作</th></tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td className="p-3" colSpan={5}>読み込み中…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-3" colSpan={5}>利用者はまだいません。</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.userId} className="border-b border-[#E0DDD8] last:border-0">
                  <td className="p-3 font-bold">{r.displayName}</td>
                  <td className="p-3">{r.email ?? "—"}</td>
                  <td className="p-3">{r.isApprover ? "承認者" : "担当者"}</td>
                  <td className="p-3">{r.activated ? "利用中" : "招待中（パスワード未設定）"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btn} onClick={() => change(r, { isApprover: !r.isApprover })}>
                        {r.isApprover ? "担当者にする" : "承認者にする"}
                      </button>
                      <button type="button" className={`${btn} text-[#991B1B]`} onClick={() => change(r, { deactivate: true })}>利用停止</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={invite} className="max-w-xl space-y-3 rounded border border-[#E0DDD8] bg-white p-4">
        <h2 className="font-bold">アカウントを発行する</h2>
        <label className="block text-sm font-bold">氏名<input className={field} required maxLength={50} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="例: 永村 隆司" /></label>
        <label className="block text-sm font-bold">メールアドレス<input className={field} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="h-5 w-5" checked={form.isApprover} onChange={(e) => setForm({ ...form, isApprover: e.target.checked })} />
          承認者（一括実行＝決済の確定ができる）
        </label>
        <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>課金予約した本人はその請求を一括実行できないため、担当者と承認者は別の方にしてください。</p>
        <button type="submit" disabled={busy || !merchantId} className="min-h-[44px] rounded bg-[#4C986A] px-5 font-bold text-white hover:bg-[#3D7A55] disabled:opacity-50">
          {busy ? "発行中…" : "発行して招待メールを送る"}
        </button>
      </form>
    </div>
  );
}
