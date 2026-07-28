"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/** ナビゲーション定義 */
const NAV_ITEMS = [
  { href: "/udpay", label: "ダッシュボード" },
  { href: "/udpay/customers", label: "顧客管理" },
  { href: "/udpay/invoices", label: "請求管理" },
  { href: "/udpay/payments", label: "入金管理" },
] as const;

/**
 * UD Payment（仮）デモの共通ヘッダー。
 * ブランド表示・ナビゲーション・デモデータ初期化ボタンを提供する。
 */
export function UdpayHeader() {
  const pathname = usePathname();
  const router = useRouter();

  /** デモデータを初期状態に戻す */
  async function resetDemo() {
    if (!confirm("デモデータを初期状態に戻します。よろしいですか？")) return;
    await fetch("/api/udpay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resetDemo" }),
    });
    router.push("/udpay");
    router.refresh();
  }

  return (
    <header className="up-header">
      <Link href="/udpay" className="up-brand" style={{ textDecoration: "none" }}>
        <span className="up-brand-name">
          UD <span>Payment</span>
        </span>
        <span className="up-brand-sub">請求・カード自動課金サービス</span>
      </Link>
      <nav className="up-nav">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/udpay"
              ? pathname === "/udpay"
              : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <span className="up-demo-badge">デモ環境（決済は模擬）</span>
      <button
        type="button"
        className="up-btn secondary small"
        onClick={resetDemo}
      >
        初期化
      </button>
    </header>
  );
}
