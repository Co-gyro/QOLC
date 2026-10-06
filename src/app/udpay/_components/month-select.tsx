"use client";

import { useRouter } from "next/navigation";
import { formatMonthJa } from "@/lib/udpay/logic";

/**
 * 月タブの右端に置く「それより前の月」の選択。選ぶとすぐその月へ移動する（表示ボタン不要）。
 */
export function MonthSelect({
  months,
  value,
  hrefs,
}: {
  months: string[];
  value: string;
  /** 月ごとの移動先（絞り込み条件を引き継いだ URL） */
  hrefs: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <select
      className="up-tab-select"
      aria-label="それより前の月"
      value={months.includes(value) ? value : ""}
      onChange={(e) => {
        const href = hrefs[e.target.value];
        if (href) router.push(href);
      }}
    >
      <option value="" disabled>
        それより前の月
      </option>
      {months.map((m) => (
        <option key={m} value={m}>
          {formatMonthJa(m)}
        </option>
      ))}
    </select>
  );
}
