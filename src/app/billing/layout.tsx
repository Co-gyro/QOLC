import "../udpay/udpay.css";
import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";

/**
 * UD Payment（本番）の共通レイアウト。見た目はデモ（/udpay）と同じスタイルを使う。
 * ログインと加盟店の判定は middleware（udpay_merchant ロール）と各画面（udpay_members）で行う。
 */
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UD Payment | 請求・カード自動課金",
  robots: { index: false, follow: false },
};

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`udpay-root ${notoSansJP.variable}`}
      style={{ fontFamily: "var(--font-noto-sans-jp), 'Hiragino Kaku Gothic ProN', system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
