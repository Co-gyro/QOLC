import "./udpay.css";
import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";

/**
 * UD Payment（仮）デモの共通レイアウト。
 * ルート layout が <html>/<body> を提供するため、ここではフォントと
 * スコープ用ラッパーのみを定義する（QOLCアプリ本体には影響しない）。
 */
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UD Payment（仮）| 請求・カード自動課金サービス デモ",
  description:
    "毎月の請求書作成から登録カードへの自動課金・消込・領収書発行までをワンストップで行うデモ環境です。",
  robots: { index: false, follow: false },
};

export default function UdpayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`udpay-root ${notoSansJP.variable}`}
      style={{
        fontFamily:
          "var(--font-noto-sans-jp), 'Hiragino Kaku Gothic ProN', system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
