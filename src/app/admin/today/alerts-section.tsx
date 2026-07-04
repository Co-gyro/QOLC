"use client";

/**
 * 「今日のUD」③要対応アラート: 決済失敗/保留・期限超過タスク・プール残数警告
 */
import Link from "next/link";
import type { PoolAvailability } from "@/lib/portal/admin-queries";
import type { PaymentAlertCounts, TodayRun } from "@/lib/portal/today-queries";
import { fmtDate } from "@/lib/portal/workflow-client";

/** プール残数がこの件数を下回ったら警告を出す */
export const POOL_WARN_THRESHOLD = 10;

export interface AlertsSectionProps {
  payments: PaymentAlertCounts | null;
  overdueRuns: TodayRun[];
  pool: PoolAvailability | null;
}

/** アラート1行（リンク付き） */
function AlertRow({ href, text, sub }: { href: string; text: string; sub?: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border rounded-md px-4 py-3 min-h-[44px] hover:bg-gray-50"
        style={{ borderColor: "#E8913A", backgroundColor: "#FFFBF5" }}
      >
        <span className="font-medium" style={{ color: "#B45309" }}>
          {text}
        </span>
        {sub && (
          <span className="text-sm" style={{ color: "var(--qolc-muted)" }}>
            {sub}
          </span>
        )}
        <span className="ml-auto text-sm font-medium" style={{ color: "var(--qolc-primary)" }}>
          対応する →
        </span>
      </Link>
    </li>
  );
}

export function AlertsSection({ payments, overdueRuns, pool }: AlertsSectionProps) {
  const rows: React.ReactNode[] = [];

  if (payments && payments.failed > 0) {
    rows.push(
      <AlertRow
        key="failed"
        href="/admin/payments?status=failed"
        text={`失敗した決済が ${payments.failed} 件あります`}
        sub="カード有効期限切れ等の対応が必要です"
      />
    );
  }
  if (payments && payments.pending > 0) {
    rows.push(
      <AlertRow
        key="pending"
        href="/admin/payments"
        text={`保留中の決済が ${payments.pending} 件あります`}
        sub="保留理由を確認して再実行または取消してください"
      />
    );
  }
  for (const r of overdueRuns) {
    rows.push(
      <AlertRow
        key={`run-${r.id}`}
        href={`/admin/tasks/${r.id}`}
        text={`期限超過: ${r.title}`}
        sub={`期限 ${fmtDate(r.dueDate)}`}
      />
    );
  }
  if (pool && pool.mallCode.available < POOL_WARN_THRESHOLD) {
    rows.push(
      <AlertRow
        key="pool-mall"
        href="/admin/master"
        text={`モールコードの残りが ${pool.mallCode.available} 件です`}
        sub="モールコード＝USEN決済上で加盟店を識別するコード。枯渇前に追加発番の手配が必要です"
      />
    );
  }
  if (pool && pool.terminalId.available < POOL_WARN_THRESHOLD) {
    rows.push(
      <AlertRow
        key="pool-terminal"
        href="/admin/master"
        text={`端末識別番号の残りが ${pool.terminalId.available} 件です`}
        sub="端末識別番号＝USEN決済の端末単位の番号。枯渇前に追加発番の手配が必要です"
      />
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--qolc-text)" }}>
        要対応アラート
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--qolc-muted)" }}>
        放置するとお客さまに影響が出る項目です。優先して対応してください。
      </p>
      {rows.length === 0 ? (
        <p
          className="text-sm border rounded-md px-4 py-3"
          style={{ borderColor: "var(--qolc-border)", color: "var(--qolc-muted)" }}
        >
          現在、要対応のアラートはありません。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">{rows}</ul>
      )}
    </section>
  );
}
