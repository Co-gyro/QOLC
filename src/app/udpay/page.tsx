import Link from "next/link";
import { loadStore } from "@/lib/udpay/store";
import {
  computeTotals,
  currentMonth,
  formatMonthJa,
  formatYen,
} from "@/lib/udpay/logic";
import { UdpayHeader } from "./header";

export const dynamic = "force-dynamic";

/**
 * UD Payment（仮）デモのダッシュボード。
 * 当月の請求・入金状況のサマリとデモの進め方を表示する。
 */
export default async function UdpayDashboardPage() {
  const store = await loadStore();
  const month = currentMonth();
  const invoices = store.invoices.filter((i) => i.month === month);
  const confirmed = invoices.filter((i) => i.status === "confirmed");
  const billedTotal = confirmed.reduce(
    (sum, i) => sum + computeTotals(i.lines).total,
    0,
  );
  const payments = store.payments.filter((p) =>
    confirmed.some((i) => i.id === p.invoiceId),
  );
  const paid = payments.filter((p) => p.status === "paid");
  const failed = payments.filter((p) => p.status === "failed");
  const cardRegistered = store.customers.filter((c) => c.card.registered).length;

  return (
    <div>
      <UdpayHeader />
      <main className="up-container">
        <h1>ダッシュボード</h1>
        <p className="up-lead">
          {formatMonthJa(month)}サービス分の請求・入金状況（デモデータ）
        </p>

        <div className="up-grid">
          <div className="up-card">
            <div className="up-stat-label">請求先顧客</div>
            <div className="up-stat-value">{store.customers.length}件</div>
            <div className="up-stat-label">カード登録済み {cardRegistered}件</div>
          </div>
          <div className="up-card">
            <div className="up-stat-label">当月の確定済み請求</div>
            <div className="up-stat-value">{confirmed.length}件</div>
            <div className="up-stat-label">請求総額 {formatYen(billedTotal)}</div>
          </div>
          <div className="up-card">
            <div className="up-stat-label">入金済み</div>
            <div className="up-stat-value green">{paid.length}件</div>
            <div className="up-stat-label">
              {formatYen(paid.reduce((s, p) => s + p.amount, 0))}
            </div>
          </div>
          <div className="up-card">
            <div className="up-stat-label">与信落ち（要対応）</div>
            <div className={`up-stat-value ${failed.length > 0 ? "red" : ""}`}>
              {failed.length}件
            </div>
            <div className="up-stat-label">
              {failed.length > 0 ? (
                <Link href="/udpay/payments">入金管理で再決済 →</Link>
              ) : (
                "対応が必要な決済はありません"
              )}
            </div>
          </div>
        </div>

        <section className="up-section up-card">
          <h2>毎月の運用はこれだけ</h2>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2.1 }}>
            <li>
              <Link href="/udpay/invoices">請求管理</Link>
              で「前月分をコピー」— 交通費やオプションなど変わった分だけ修正して確定
            </li>
            <li>確定と同時に、各顧客へ請求明細メールが自動送付されます</li>
            <li>
              各顧客の課金日（初回決済日と同じ日）に登録カードへ自動課金。
              <Link href="/udpay/payments">入金管理</Link>で消込状況を確認
            </li>
            <li>与信落ちがあれば通知が届き、ワンクリックで再決済。入金後は領収書も自動発行</li>
          </ol>
          <p style={{ color: "var(--muted)", marginTop: 12, marginBottom: 0 }}>
            新しい顧客のカード登録は
            <Link href="/udpay/customers">顧客管理</Link>
            から登録リンクをメールで送るだけ。カード番号は貴社でもUD側でも一切保持しません。
          </p>
        </section>
      </main>
    </div>
  );
}
