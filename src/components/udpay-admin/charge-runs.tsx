"use client";

import { useEffect, useState } from "react";
import { udpayAdminFetch } from "./api";

/** 実行記録1件（/api/admin/udpay/charge-runs） */
interface ChargeRun {
  at: string;
  date: string;
  captured: number;
  failed: number;
  unknown: number;
  recovered: number;
  error: string | null;
}

/** ISO 日時を「M/D HH:mm」（日本時間）にする */
function jst(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * 毎朝の自動課金の実行記録（UD管理画面）。最後の実行が昨日以前なら注意を出す。
 */
export function UdpayChargeRuns() {
  const [runs, setRuns] = useState<ChargeRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    udpayAdminFetch<ChargeRun[]>("/api/admin/udpay/charge-runs").then(setRuns).catch((e: Error) => setError(e.message));
  }, []);
  if (error) return <p className="rounded bg-[#FEE2E2] p-3 text-[#991B1B]">{error}</p>;
  if (!runs) return null;
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const last = runs[0];
  const stale = !last || last.date < today;
  return (
    <section className="mb-4 rounded border border-[#E0DDD8] bg-white p-4">
      <h2 className="font-bold">毎朝の自動課金（9時ごろ）</h2>
      {!last ? (
        <p className="mt-1" style={{ color: "var(--qolc-muted)" }}>まだ実行記録がありません（反映後の最初の朝から記録されます）。</p>
      ) : (
        <p className="mt-1">
          最後の実行: <strong>{jst(last.at)}</strong>　入金済み {last.captured}件／与信落ち {last.failed}件
          {last.unknown > 0 && `／確認中 ${last.unknown}件`}
          {last.error && <span className="ml-2 text-[#991B1B]">エラー: {last.error}</span>}
          {stale && <span className="ml-2 rounded bg-[#FEF4E2] px-2 font-bold text-[#B45309]">今日はまだ実行されていません</span>}
        </p>
      )}
      {runs.length > 1 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer" style={{ color: "var(--qolc-muted)" }}>直近の実行記録</summary>
          <ul className="mt-1 space-y-0.5">
            {runs.map((r) => (
              <li key={r.at}>
                {jst(r.at)}　入金済み {r.captured}／与信落ち {r.failed}
                {r.unknown > 0 && `／確認中 ${r.unknown}`}
                {r.error && `／エラー ${r.error}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
