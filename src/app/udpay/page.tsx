import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import { addDays, computeTotals, currentMonth, formatDateJa, formatYen, todayJst } from "@/lib/udpay/logic";
import { cardExpiryStatus } from "@/lib/payment/card-expiry";
import { UdpayHeader } from "./header";
import { StatusLegend } from "./_components/status";

export const dynamic = "force-dynamic";

/** 「今日やること」の1項目 */
interface TodoItem {
  label: string;
  count: number;
  detail?: string;
  href: string;
  action: string;
  tone: "red" | "amber" | "blue";
}

/**
 * UD Payment（仮）デモのダッシュボード。
 * 「今日やること」（未実行の課金予約・今日明日の課金・与信落ち・カード未登録・期限間近）を一覧し、
 * 毎月の運用の流れを示す。
 */
export default async function UdpayDashboardPage() {
  const store = await loadStore();
  const today = todayJst();
  const tomorrow = addDays(today, 1);
  const month = currentMonth();
  const reserved = store.invoices.filter((i) => i.status === "reserved");
  const drafts = store.invoices.filter((i) => i.status === "draft" && i.month === month);
  const soon = store.payments.filter(
    (p) => p.status === "scheduled" && (p.scheduledDate === today || p.scheduledDate === tomorrow),
  );
  const failed = store.payments.filter((p) => p.status === "failed");
  const failedMonth = store.invoices.find((i) => i.id === failed[0]?.invoiceId)?.month ?? month;
  const unregistered = store.customers.filter((c) => !c.card.registered);
  const expiring = store.customers.filter(
    (c) => c.card.registered && ["expiring", "expired"].includes(cardExpiryStatus(c.card.expireYm, today)),
  );
  const sum = (ids: string[]) =>
    store.invoices.filter((i) => ids.includes(i.id)).reduce((s, i) => s + computeTotals(i.lines).total, 0);

  const todos: TodoItem[] = [
    { label: "与信落ち（要対応）", count: failed.length, detail: formatYen(failed.reduce((s, p) => s + p.amount, 0)), href: `/udpay/payments?month=${failedMonth}&status=failed`, action: "顧客へ連絡して再決済", tone: "red" },
    { label: "課金予約のまま一括実行していない請求", count: reserved.length, detail: formatYen(sum(reserved.map((i) => i.id))), href: "/udpay/payments/confirm", action: "承認者が一括実行", tone: "amber" },
    { label: `今日・明日（${formatDateJa(tomorrow)}まで）の課金予定`, count: soon.length, detail: formatYen(soon.reduce((s, p) => s + p.amount, 0)), href: "/udpay/payments", action: "内容を確認", tone: "blue" },
    { label: "当月の下書き", count: drafts.length, href: `/udpay/invoices?month=${month}&status=draft`, action: "確認して課金予約", tone: "blue" },
    { label: "カード未登録の顧客", count: unregistered.length, href: "/udpay/customers?card=unregistered", action: "登録リンクを送る", tone: "amber" },
    { label: "カードの有効期限が近い・切れた顧客", count: expiring.length, href: "/udpay/customers?card=expiring", action: "更新のご案内（本番は自動メール）", tone: "amber" },
  ];
  const active = todos.filter((t) => t.count > 0);

  return (
    <div>
      <UdpayHeader />
      <main className="up-container">
        <h1>ダッシュボード</h1>
        <p className="up-lead">{formatDateJa(today)}時点（デモデータ）</p>

        <section className="up-card">
          <h2>今日やること</h2>
          {active.length === 0 ? (
            <p className="up-muted" style={{ margin: 0 }}>対応が必要なことはありません。</p>
          ) : (
            <ul className="up-todo">
              {active.map((t) => (
                <li key={t.label}>
                  <span>
                    <span className="count" style={{ color: `var(--${t.tone === "blue" ? "blue-dark" : t.tone})` }}>
                      {t.count}件
                    </span>
                    {t.label}
                    {t.detail && <span className="up-muted">（{t.detail}）</span>}
                  </span>
                  <Link className="up-btn secondary small" href={t.href}>
                    {t.action} →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="up-section up-card">
          <h2>毎月の流れ</h2>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2.1 }}>
            <li>
              <Link href="/udpay/invoices">請求管理</Link>で「直近の請求からコピー」（またはCSV取込）→ 変わった分だけ直して「課金予約」（担当者・メールはまだ送られません）
            </li>
            <li>
              <Link href="/udpay/payments">入金管理</Link>の「一括実行」で内容を確認し、承認者が実行 → 請求メールを一括送信・決済確定
            </li>
            <li>各顧客の決済日の朝に登録カードへ自動課金 → 入金済み。与信落ちはお知らせが届き、再決済できます</li>
            <li>決済確定は決済日の前日まで取り消せます。課金予約はいつでも下書きに戻せます</li>
          </ol>
          <div style={{ marginTop: 12 }}>
            <StatusLegend />
          </div>
        </section>
      </main>
    </div>
  );
}
