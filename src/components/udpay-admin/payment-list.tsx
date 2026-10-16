"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminPaymentRow } from "@/lib/udpay/prod/admin-payments";
import type { UdpayMerchant } from "@/lib/udpay/prod/merchants";
import { udpayAdminFetch } from "./api";

/** 決済の状態の表示名 */
const STATUS_LABEL: Record<string, string> = {
  scheduled: "課金待ち",
  processing: "処理中",
  captured: "入金済み",
  failed: "与信落ち",
  cancelled: "取消済み（当日）",
  refunded: "返品済み",
};

/** ISO 日時を「M/D HH:mm」（日本時間）にする */
function jst(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * UD Payment 加盟店の決済一覧（UD管理画面）。入金済みの決済を全額取消・返品できる。
 * 課金当日は「取消」（明細に載らない）、翌日以降は「返品」（明細に請求と返金が載る）を自動で選ぶ。
 */
export function UdpayPaymentList() {
  const [merchants, setMerchants] = useState<UdpayMerchant[]>([]);
  const [merchantId, setMerchantId] = useState("");
  const [rows, setRows] = useState<AdminPaymentRow[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    udpayAdminFetch<UdpayMerchant[]>("/api/admin/udpay/merchants")
      .then((list) => {
        setMerchants(list);
        if (list[0]) setMerchantId(list[0].id);
      })
      .catch((e: Error) => setMessage({ ok: false, text: e.message }));
  }, []);

  const load = useCallback(() => {
    if (!merchantId) return;
    udpayAdminFetch<AdminPaymentRow[]>(`/api/admin/udpay/payments?merchantId=${merchantId}`)
      .then(setRows)
      .catch((e: Error) => setMessage({ ok: false, text: e.message }));
  }, [merchantId]);
  useEffect(load, [load]);

  async function refund(row: AdminPaymentRow) {
    const what =
      row.refundKind === "cancel"
        ? "【取消】課金当日のため、売上取消と与信取消を行います。カードの利用明細には載りません。"
        : "【返品】課金の翌日以降のため返品します。カードの利用明細には請求と返金の両方が載ります。";
    if (!confirm(`${row.customerName}　${row.amount.toLocaleString("ja-JP")}円\n\n${what}\n全額を戻します。よろしいですか？`)) return;
    setBusyId(row.id);
    setMessage(null);
    try {
      const r = await udpayAdminFetch<{ kind: "cancel" | "return" }>(`/api/admin/udpay/payments/${row.id}/refund`, { method: "POST" });
      setMessage({ ok: true, text: `${row.customerName}：${r.kind === "cancel" ? "取消" : "返品"}しました` });
      load();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "失敗しました" });
    } finally {
      setBusyId(null);
    }
  }

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
      {message && (
        <p className={`rounded p-3 ${message.ok ? "bg-[#F0F9F4] text-[#3D7A55]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>{message.text}</p>
      )}
      {rows === null ? (
        <p>読み込み中…</p>
      ) : rows.length === 0 ? (
        <p className="rounded border border-dashed border-[#E0DDD8] p-6 text-center">決済はまだありません。</p>
      ) : (
        <div className="overflow-x-auto rounded border border-[#E0DDD8] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E0DDD8] bg-[#F0F9F4]">
              <tr>
                <th className="p-3">顧客名・対象月</th>
                <th className="p-3 text-right">金額（税込）</th>
                <th className="p-3">課金日</th>
                <th className="p-3">状態</th>
                <th className="p-3">受注コード・試行</th>
                <th className="p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#E0DDD8] align-top last:border-0">
                  <td className="p-3">
                    <div className="font-bold">{r.customerName}</div>
                    <div style={{ color: "var(--qolc-muted)" }}>{r.serviceMonth}分</div>
                  </td>
                  <td className="p-3 text-right">{r.amount.toLocaleString("ja-JP")}円</td>
                  <td className="p-3">{r.scheduledDate}</td>
                  <td className="p-3">
                    <div className="font-bold">{STATUS_LABEL[r.status] ?? r.status}</div>
                    <div style={{ color: "var(--qolc-muted)" }}>
                      {r.capturedAt && `入金 ${jst(r.capturedAt)}`}
                      {r.cancelledAt && r.capturedAt && ` ／ 取消 ${jst(r.cancelledAt)}`}
                      {r.refundedAt && ` ／ 返品 ${jst(r.refundedAt)}`}
                    </div>
                    {r.lastError && <div className="text-[#991B1B]">{r.lastError}</div>}
                  </td>
                  <td className="p-3">
                    <div>{r.jutyuCd ?? "—"}</div>
                    <div style={{ color: "var(--qolc-muted)" }}>{r.attemptCount}回</div>
                  </td>
                  <td className="p-3">
                    {r.refundKind ? (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => refund(r)}
                        className="min-h-[44px] rounded border border-[#991B1B] bg-white px-3 font-bold text-[#991B1B] hover:bg-[#FEE2E2] disabled:opacity-50"
                      >
                        {busyId === r.id ? "処理中…" : r.refundKind === "cancel" ? "取消（当日）" : "返品"}
                      </button>
                    ) : (
                      <span style={{ color: "var(--qolc-muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
