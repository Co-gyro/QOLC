"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MerchantAccount } from "@/lib/admin/merchant-accounts";
import { udpayAdminFetch } from "@/components/udpay-admin/api";
import { jstDateTime } from "./fmt";

const STATUS: Record<MerchantAccount["status"], { label: string; cls: string }> = {
  invited: { label: "招待中（パスワード未設定）", cls: "bg-[#FEF4E2] text-[#B45309]" },
  active: { label: "利用中", cls: "bg-[#F0F9F4] text-[#3D7A55]" },
  suspended: { label: "停止中", cls: "bg-[#FEE2E2] text-[#991B1B]" },
};

/**
 * 加盟店カルテ「利用者」: 加盟店のログインアカウント（提供者・UD Payment 利用者）。
 * パスワード設定メールの送信（招待のし直し・再設定）と、利用停止／再開ができる。
 */
export function AccountsTab({ merchantId, hasUdpay }: { merchantId: string; hasUdpay: boolean }) {
  const [rows, setRows] = useState<MerchantAccount[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string; link?: string } | null>(null);

  const load = useCallback(() => {
    udpayAdminFetch<MerchantAccount[]>(`/api/admin/merchants/${merchantId}/accounts`).then(setRows).catch((e: Error) => setResult({ ok: false, text: e.message }));
  }, [merchantId]);
  useEffect(load, [load]);

  async function act(row: MerchantAccount, action: "password_setup" | "suspend" | "resume") {
    const ask = {
      password_setup: `${row.displayName} さん（${row.email}）へパスワード設定メールを送ります。相手がリンクからパスワードを設定し直します。よろしいですか？`,
      suspend: `${row.displayName} さんの利用を停止します（ログインできなくなります）。よろしいですか？`,
      resume: `${row.displayName} さんの利用を再開します。よろしいですか？`,
    }[action];
    if (!confirm(ask)) return;
    setBusy(row.userId);
    setResult(null);
    try {
      const r = await udpayAdminFetch<{ link?: string; emailSent?: boolean }>(`/api/admin/merchants/${merchantId}/accounts/${row.userId}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (action === "password_setup") {
        setResult({
          ok: true,
          text: r.emailSent ? `${row.email} へパスワード設定メールを送りました。` : "メールを送れませんでした。下のリンクを別の方法でお送りください。",
          link: r.link,
        });
      } else {
        setResult({ ok: true, text: action === "suspend" ? `${row.displayName} さんの利用を停止しました。` : `${row.displayName} さんの利用を再開しました。` });
      }
      load();
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "失敗しました" });
    } finally {
      setBusy(null);
    }
  }

  const btn = "min-h-[40px] rounded border border-[#E0DDD8] bg-white px-3 text-sm font-bold hover:bg-[#F0F9F4] disabled:opacity-50";
  return (
    <div className="space-y-3">
      {result && (
        <div className={`rounded p-3 ${result.ok ? "bg-[#F0F9F4]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
          <p>{result.text}</p>
          {result.link && (
            <p className="mt-1 break-all text-sm">
              パスワード設定リンク（24時間有効）: {result.link}
              <button type="button" className={`${btn} ml-2`} onClick={() => navigator.clipboard.writeText(result.link ?? "")}>コピー</button>
            </p>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded border border-[#E0DDD8] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#E0DDD8] bg-[#F0F9F4]">
            <tr><th className="p-3">氏名・メール</th><th className="p-3">権限</th><th className="p-3">状態</th><th className="p-3">最終ログイン</th><th className="p-3">操作</th></tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td className="p-3" colSpan={5}>読み込み中…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-3" colSpan={5}>この加盟店のログインアカウントはありません。</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.userId} className="border-b border-[#E0DDD8] align-top last:border-0">
                  <td className="p-3"><div className="font-bold">{r.displayName}</div><div style={{ color: "var(--qolc-muted)" }}>{r.email ?? "—"}</div></td>
                  <td className="p-3">{r.roleLabel}</td>
                  <td className="p-3"><span className={`rounded px-2 py-0.5 font-bold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></td>
                  <td className="p-3">{jstDateTime(r.lastSignInAt)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btn} disabled={busy !== null || r.status === "suspended"} title={r.status === "suspended" ? "停止中は送れません。先に再開してください" : undefined} onClick={() => act(r, "password_setup")}>
                        パスワード設定メールを送る
                      </button>
                      {r.status === "suspended" ? (
                        <button type="button" className={btn} disabled={busy !== null} onClick={() => act(r, "resume")}>再開</button>
                      ) : (
                        <button type="button" className={`${btn} text-[#991B1B]`} disabled={busy !== null} onClick={() => act(r, "suspend")}>利用停止</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        「パスワード設定メールを送る」は、招待メールの期限切れ（招待のし直し）と、パスワードを忘れたときの再設定の両方に使えます。
        {hasUdpay && (
          <>
            {" "}UD Payment の利用者の新規発行・承認権限の変更は{" "}
            <Link href="/admin/udpay/members" className="text-[#3D7A55] underline">UD Payment の利用者のアカウント</Link> から行います。
          </>
        )}
      </p>
    </div>
  );
}
