"use client";

import Link from "next/link";
import type { MerchantOverview } from "@/lib/admin/merchant-overview";

/** ラベルと値 */
function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt style={{ color: "var(--qolc-muted)" }}>{label}</dt>
      <dd className="font-mono">{value || "—"}</dd>
    </>
  );
}

/**
 * 加盟店カルテ「カード会社・精算」: USEN のモールコード・端末番号、カード会社の加盟店番号。
 * 編集・Selfish登録は加盟店一覧の各行から行う（カルテへの移設は段階3）。
 */
export function CardTab({ data }: { data: MerchantOverview }) {
  const m = data.merchant;
  return (
    <div className="space-y-3">
      <section className="rounded border border-[#E0DDD8] bg-white p-4">
        <dl className="grid grid-cols-[12rem_1fr] gap-y-1 text-sm">
          <Item label="モールコード（USEN）" value={m.mallCode} />
          <Item label="端末識別番号" value={m.terminalId} />
          <Item label="JCB 加盟店番号（EC）" value={m.jcbEc} />
          <Item label="JCB 加盟店番号（継続）" value={m.jcbRecurring} />
          <Item label="セゾン 加盟店番号" value={m.saison} />
        </dl>
      </section>
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        加盟店番号の編集・料率の確認・Selfish への登録は{" "}
        <Link href={`/admin/merchants?highlight=${m.id}`} className="text-[#3D7A55] underline">加盟店一覧</Link> の該当の行から行えます。
      </p>
    </div>
  );
}
