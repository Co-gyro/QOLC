"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SERVICE_KINDS,
  SERVICE_LABEL,
  SERVICE_STATUSES,
  STATUS_LABEL,
  type MerchantService,
  type ServiceKind,
  type ServiceStatus,
} from "@/lib/admin/merchant-services";
import { udpayAdminFetch } from "@/components/udpay-admin/api";
import { jstDateTime } from "./fmt";

const STATUS_CLS: Record<ServiceStatus, string> = {
  preparing: "bg-[#FEF4E2] text-[#B45309]",
  active: "bg-[#F0F9F4] text-[#3D7A55]",
  suspended: "bg-[#FEE2E2] text-[#991B1B]",
  terminated: "bg-[#EEF0F4] text-[#4B5563]",
};

/** 編集中の契約 */
interface Draft {
  service: ServiceKind;
  status: ServiceStatus;
  planName: string;
  seatLimit: string;
  startedOn: string;
  endedOn: string;
  notes: string;
}

/** 既存の契約から編集用の値を作る（新規は空） */
function toDraft(s?: MerchantService, service: ServiceKind = "udpay"): Draft {
  return {
    service: s?.service ?? service,
    status: s?.status ?? "preparing",
    planName: s?.planName ?? "",
    seatLimit: s?.seatLimit === null || s?.seatLimit === undefined ? "" : String(s.seatLimit),
    startedOn: s?.startedOn ?? "",
    endedOn: s?.endedOn ?? "",
    notes: s?.notes ?? "",
  };
}

/**
 * 加盟店カルテ「契約・ライセンス」: サービスごとの契約（状態・プラン名・利用人数の上限）を記録・変更する。
 * 利用中の人数は実際のアカウント数（UD Payment=利用者、QOLC=提供者アカウント）。
 */
export function ContractsTab({ merchantId }: { merchantId: string }) {
  const [data, setData] = useState<{ ready: boolean; services: MerchantService[] } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    udpayAdminFetch<{ ready: boolean; services: MerchantService[] }>(`/api/admin/merchants/${merchantId}/services`)
      .then(setData)
      .catch((e: Error) => setMessage({ ok: false, text: e.message }));
  }, [merchantId]);
  useEffect(load, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    try {
      await udpayAdminFetch(`/api/admin/merchants/${merchantId}/services`, {
        method: "POST",
        body: JSON.stringify({ ...draft, seatLimit: draft.seatLimit === "" ? null : Number(draft.seatLimit) }),
      });
      setMessage({ ok: true, text: `${SERVICE_LABEL[draft.service]}の契約を保存しました` });
      setDraft(null);
      load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "保存に失敗しました" });
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p>読み込み中…</p>;
  if (!data.ready) {
    return <p className="rounded bg-[#FEF4E2] p-4 text-sm text-[#B45309]">契約を記録するテーブルがまだありません。SQL（migration 041）を適用すると使えるようになります。</p>;
  }
  const unused = SERVICE_KINDS.filter((k) => !data.services.some((s) => s.service === k));
  const field = "mt-1 block min-h-[44px] w-full rounded border border-[#E0DDD8] px-3";
  const btn = "min-h-[40px] rounded border border-[#E0DDD8] bg-white px-3 text-sm font-bold hover:bg-[#F0F9F4]";
  return (
    <div className="space-y-3">
      {message && <p className={`rounded p-3 ${message.ok ? "bg-[#F0F9F4] text-[#3D7A55]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>{message.text}</p>}
      {data.services.length === 0 && <p className="rounded border border-dashed border-[#E0DDD8] p-4 text-sm">まだ契約が記録されていません。</p>}
      {data.services.map((s) => (
        <section key={s.id} className="rounded border border-[#E0DDD8] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">
              {SERVICE_LABEL[s.service]}
              <span className={`ml-2 rounded px-2 py-0.5 text-sm ${STATUS_CLS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
            </h3>
            <button type="button" className={btn} onClick={() => setDraft(toDraft(s))}>変更</button>
          </div>
          <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
            <dt style={{ color: "var(--qolc-muted)" }}>プラン名</dt><dd>{s.planName ?? "—"}</dd>
            <dt style={{ color: "var(--qolc-muted)" }}>利用人数</dt>
            <dd>
              {s.seatsUsed === null ? "（人数で数えないサービス）" : `${s.seatsUsed}名 ／ 上限 ${s.seatLimit === null ? "なし" : `${s.seatLimit}名`}`}
              {s.seatLimit !== null && s.seatsUsed !== null && s.seatsUsed >= s.seatLimit && (
                <span className="ml-2 rounded bg-[#FEF4E2] px-2 font-bold text-[#B45309]">上限に達しています</span>
              )}
            </dd>
            <dt style={{ color: "var(--qolc-muted)" }}>期間</dt><dd>{s.startedOn ?? "—"} 〜 {s.endedOn ?? ""}</dd>
            <dt style={{ color: "var(--qolc-muted)" }}>メモ</dt><dd className="whitespace-pre-wrap">{s.notes ?? "—"}</dd>
            <dt style={{ color: "var(--qolc-muted)" }}>最終更新</dt><dd>{jstDateTime(s.updatedAt)}</dd>
          </dl>
        </section>
      ))}
      {!draft && unused.length > 0 && (
        <button type="button" className={btn} onClick={() => setDraft(toDraft(undefined, unused[0]))}>＋ 契約を追加</button>
      )}
      {draft && (
        <form onSubmit={save} className="max-w-xl space-y-3 rounded border border-[#E0DDD8] bg-white p-4">
          <h3 className="font-bold">契約の{data.services.some((s) => s.service === draft.service) ? "変更" : "追加"}</h3>
          <label className="block text-sm font-bold">
            サービス
            <select className={field} value={draft.service} disabled={data.services.some((s) => s.service === draft.service)} onChange={(e) => setDraft({ ...draft, service: e.target.value as ServiceKind })}>
              {SERVICE_KINDS.map((k) => <option key={k} value={k}>{SERVICE_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold">
            状態
            <select className={field} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ServiceStatus })}>
              {SERVICE_STATUSES.map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold">プラン名<input className={field} maxLength={100} value={draft.planName} onChange={(e) => setDraft({ ...draft, planName: e.target.value })} placeholder="例: UD Payment スタンダード" /></label>
          <label className="block text-sm font-bold">利用人数の上限（空欄は上限なし）<input className={field} inputMode="numeric" value={draft.seatLimit} onChange={(e) => setDraft({ ...draft, seatLimit: e.target.value.replace(/[^\d]/g, "") })} placeholder="例: 5" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-bold">開始日<input className={field} type="date" value={draft.startedOn} onChange={(e) => setDraft({ ...draft, startedOn: e.target.value })} /></label>
            <label className="block text-sm font-bold">終了日<input className={field} type="date" value={draft.endedOn} onChange={(e) => setDraft({ ...draft, endedOn: e.target.value })} /></label>
          </div>
          <label className="block text-sm font-bold">メモ<textarea className={`${field} min-h-[80px] py-2`} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
          <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>一時停止・解約にすると、そのサービスのアカウントは新しく発行できなくなります（今あるアカウントは止まりません。必要なら利用者タブで停止してください）。</p>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="min-h-[44px] rounded bg-[#4C986A] px-5 font-bold text-white hover:bg-[#3D7A55] disabled:opacity-50">{busy ? "保存中…" : "保存する"}</button>
            <button type="button" className={btn} onClick={() => setDraft(null)}>キャンセル</button>
          </div>
        </form>
      )}
    </div>
  );
}
