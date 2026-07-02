import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";

/**
 * 紹介サイト（qolc.jp）共通レイアウト。
 * ルート layout が <html>/<body> を提供するため、ここではマーケ用のフォントと
 * デザイントークンを適用するラッパーのみを定義する（アプリ側には影響しない）。
 */
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QOLC（コルク）| 介護施設向けキャッシュレス決済サービス",
  description:
    "入居者の自己負担額をクレジットカードで非対面決済。ご家族はLINEで明細をリアルタイム確認。現金管理・立替・郵送物をゼロに。",
};

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={notoSansJP.variable}
      style={{
        fontFamily:
          "var(--font-noto-sans-jp), 'Hiragino Kaku Gothic ProN', system-ui, sans-serif",
        color: "#333333",
        background: "#ffffff",
        minHeight: "100vh",
        lineHeight: 1.8,
      }}
    >
      {children}
    </div>
  );
}
