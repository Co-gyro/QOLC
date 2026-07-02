import Link from "next/link";
import type { JSX } from "react";

/** アプリ本体のベースURL。 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qolc.jp";

/** フッター内リンク列の見出し。 */
function ColHeading({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: 1 }}>
      {children}
    </div>
  );
}

/** サイト共通フッター（3列リンク＋著作権表記）。 */
export default function SiteFooter(): JSX.Element {
  return (
    <footer className="site-footer" style={{ padding: "32px 20px" }}>
      <div className="footer-logo">
        <img src="/site/QOLC_rogo2.png" alt="QOLC" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 0, marginBottom: 16 }}>
        <div style={{ margin: "0 16px 8px" }}>
          <ColHeading>SERVICE</ColHeading>
          <div className="footer-links" style={{ display: "flex", flexDirection: "column", gap: 4, margin: 0 }}>
            <a href="#features-section" style={{ margin: 0, fontSize: 12 }}>サービス紹介</a>
            <a href="#pricing-section" style={{ margin: 0, fontSize: 12 }}>料金プラン</a>
            <Link href="/apply" style={{ margin: 0, fontSize: 12 }}>加盟店申請</Link>
            <a href="#faq-section" style={{ margin: 0, fontSize: 12 }}>FAQ</a>
          </div>
        </div>
        <div style={{ margin: "0 16px 8px" }}>
          <ColHeading>PORTAL</ColHeading>
          <div className="footer-links" style={{ display: "flex", flexDirection: "column", gap: 4, margin: 0 }}>
            <a href={`${APP_URL}/facility`} style={{ margin: 0, fontSize: 12 }}>施設ポータル</a>
            <a href={`${APP_URL}/user`} style={{ margin: 0, fontSize: 12 }}>ご家族ポータル</a>
            <a href={`${APP_URL}/provider`} style={{ margin: 0, fontSize: 12 }}>提供者ポータル</a>
          </div>
        </div>
        <div style={{ margin: "0 16px 8px" }}>
          <ColHeading>COMPANY</ColHeading>
          <div className="footer-links" style={{ display: "flex", flexDirection: "column", gap: 4, margin: 0 }}>
            <a href="https://uni-dev.jp" target="_blank" rel="noopener noreferrer" style={{ margin: 0, fontSize: 12 }}>
              私たちについて ↗
            </a>
            <a href="https://uni-dev.jp" target="_blank" rel="noopener noreferrer" style={{ margin: 0, fontSize: 12 }}>運営会社</a>
            <a href="#" style={{ margin: 0, fontSize: 12 }}>プライバシーポリシー</a>
            <a href="#" style={{ margin: 0, fontSize: 12 }}>利用規約</a>
            <a href="#" style={{ margin: 0, fontSize: 12 }}>お問い合わせ</a>
          </div>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 12 }}>
        &copy; 2026 Universal Development Co., Ltd. / qolc.jp
      </p>
    </footer>
  );
}
