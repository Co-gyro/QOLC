import Link from "next/link";
import { currentMonth, formatMonthJa, recentMonths } from "@/lib/udpay/logic";
import { MonthSelect } from "./month-select";

/** タブに並べる月数（それより前はプルダウン） */
const TAB_MONTHS = 6;
/** プルダウンで選べる過去の月数 */
const OLDER_MONTHS = 24;

/** 月タブのリンク先（他の絞り込み条件は引き継ぐ） */
function hrefFor(basePath: string, month: string, keep: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  params.set("month", month);
  for (const [k, v] of Object.entries(keep)) if (v) params.set(k, v);
  return `${basePath}?${params.toString()}`;
}

/**
 * 一覧の上端につながる月タブ（直近の数か月はタブ、それより前は右端のプルダウン）。
 * 当月に「今月」の印を付け、選択中の月のタブを一覧とつなげて表示する。
 * 条件は URL に残るため、ブラウザの戻る・URL共有でも同じ一覧が開ける。
 * 一覧（.up-table-wrap）と一緒に .up-tabbed で囲んで使う。
 */
export function MonthTabs({
  basePath,
  month,
  keep = {},
}: {
  basePath: string;
  month: string;
  keep?: Record<string, string | undefined>;
}) {
  const now = currentMonth();
  const tabs = recentMonths(TAB_MONTHS, now);
  const older = recentMonths(TAB_MONTHS + OLDER_MONTHS, now).slice(TAB_MONTHS);
  const olderHrefs = Object.fromEntries(older.map((m) => [m, hrefFor(basePath, m, keep)]));
  return (
    <nav className="up-tabs" aria-label="月の切り替え">
      {tabs.map((m) => (
        <Link
          key={m}
          href={hrefFor(basePath, m, keep)}
          className={`up-tab ${m === month ? "active" : ""}`}
          aria-current={m === month ? "page" : undefined}
        >
          {formatMonthJa(m)}
          {m === now && <span className="now">今月</span>}
        </Link>
      ))}
      <MonthSelect months={older} value={month} hrefs={olderHrefs} />
    </nav>
  );
}
