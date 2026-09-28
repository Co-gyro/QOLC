import type { CheckoutView } from "@/lib/merchant-api/service-checkout";

/** 金額の表示（円・3桁区切り） */
function yen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

/** YYYY-MM-DD を「2026年9月12日」に */
function jaDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/**
 * 決済画面のご注文内容（販売者・公演・券種・合計）。
 * 売主は加盟店であることが購入者に分かるよう、販売者名を先頭に出す。
 */
export function CheckoutSummary({ view }: { view: CheckoutView }) {
  return (
    <section className="space-y-3 rounded-lg border border-[#E0DDD8] bg-white p-5">
      <dl className="space-y-1 text-base">
        <div className="flex justify-between gap-4">
          <dt className="text-[#666666]">販売者</dt>
          <dd className="text-right font-bold">{view.merchantName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#666666]">公演</dt>
          <dd className="text-right">{view.eventName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#666666]">公演日</dt>
          <dd className="text-right">{jaDate(view.eventDate)}</dd>
        </div>
      </dl>
      <ul className="space-y-1 border-t border-[#E0DDD8] pt-3 text-base">
        {view.items.map((item, i) => (
          <li key={i} className="flex justify-between gap-4">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{yen(item.unit_price * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-[#E0DDD8] pt-3 text-lg font-bold">
        <span>お支払い合計</span>
        <span>{yen(view.amount)}</span>
      </div>
    </section>
  );
}
