"use client";

import type { MerchantOverview } from "@/lib/admin/merchant-overview";
import { jstDateTime } from "./fmt";

const STATUS = { active: "有効", suspended: "停止中", revoked: "失効" } as const;

/**
 * 加盟店カルテ「接続情報」: 加盟店API の接続情報（テスト用・本番用）。鍵の本体は表示しない。
 */
export function ConnectionTab({ data }: { data: MerchantOverview }) {
  const api = data.services.merchantApi;
  if (!api) {
    return <p className="rounded border border-dashed border-[#E0DDD8] p-4 text-sm">この加盟店には、加盟店API の接続情報がありません（UD Payment・QOLC の加盟店では通常ありません）。</p>;
  }
  return (
    <div className="space-y-3">
      {api.credentials.map((c) => (
        <section key={c.apiMerchantId} className="rounded border border-[#E0DDD8] bg-white p-4">
          <h3 className="font-bold">
            {c.environment === "production" ? "本番" : "テスト"}の接続情報
            <span className={`ml-2 rounded px-2 py-0.5 text-sm ${c.status === "active" ? "bg-[#F0F9F4] text-[#3D7A55]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>{STATUS[c.status]}</span>
          </h3>
          <dl className="mt-2 grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
            <dt style={{ color: "var(--qolc-muted)" }}>加盟店ID</dt><dd className="font-mono">{c.apiMerchantId}</dd>
            <dt style={{ color: "var(--qolc-muted)" }}>届出ドメイン</dt><dd>{c.allowedDomains.join(", ") || "—"}</dd>
            <dt style={{ color: "var(--qolc-muted)" }}>結果通知の送信先</dt><dd className="break-all">{c.webhookUrl ?? "—"}</dd>
            <dt style={{ color: "var(--qolc-muted)" }}>発行日</dt><dd>{jstDateTime(c.createdAt)}</dd>
            {c.previousSecretExpiresAt && (<><dt style={{ color: "var(--qolc-muted)" }}>旧い鍵の有効期限</dt><dd>{jstDateTime(c.previousSecretExpiresAt)}</dd></>)}
          </dl>
        </section>
      ))}
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        署名鍵は発行時に一度だけ表示し、当社では暗号化して保管しています。発行・作り直し・停止は現在UDの作業手順（docs/merchant-api-runbook.md）で行います（画面での操作は準備中）。
      </p>
    </div>
  );
}
