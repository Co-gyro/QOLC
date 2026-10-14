"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUdpayPaths } from "./_components/use-udpay-paths";

/** ナビゲーション（ベースパスからの相対） */
const NAV_ITEMS = [
  { path: "", label: "ダッシュボード" },
  { path: "/customers", label: "顧客管理" },
  { path: "/invoices", label: "請求管理" },
  { path: "/payments", label: "入金管理" },
] as const;

/**
 * UD Payment の共通ヘッダー（デモ・本番共通）。
 * デモ（/udpay）は「デモ環境」バッジと初期化ボタン、本番（/billing）はログイン中の利用者名とログアウトを出す。
 */
export function UdpayHeader({ memberName }: { memberName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { base, api, mode } = useUdpayPaths();

  /** デモデータを初期状態に戻す（デモのみ） */
  async function resetDemo() {
    if (!confirm("デモデータを初期状態に戻します。よろしいですか？")) return;
    await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resetDemo" }),
    });
    router.push(base);
    router.refresh();
  }

  return (
    <header className="up-header">
      <Link href={base} className="up-brand" style={{ textDecoration: "none" }}>
        <span className="up-brand-name">
          UD <span>Payment</span>
        </span>
        <span className="up-brand-sub">請求・カード自動課金サービス</span>
      </Link>
      <nav className="up-nav">
        {NAV_ITEMS.map((item) => {
          const href = `${base}${item.path}`;
          const active = item.path === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={active ? "active" : ""}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {mode === "demo" ? (
        <>
          <span className="up-demo-badge">デモ環境（決済は模擬）</span>
          <button type="button" className="up-btn secondary small" onClick={resetDemo}>
            初期化
          </button>
        </>
      ) : (
        <>
          {memberName && <span style={{ color: "#c7d2e6", whiteSpace: "nowrap" }}>{memberName} 様</span>}
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="up-btn secondary small">
              ログアウト
            </button>
          </form>
        </>
      )}
    </header>
  );
}
