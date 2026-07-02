"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** アプリ本体のベースURL（未設定時は本番相当のデフォルト）。 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qolc.jp";

/**
 * サイト共通ヘッダー。ロゴ・ナビ・加盟店申請・ログインドロップダウンを持つ。
 * ログインドロップダウンは開閉stateで制御し、外側クリックで閉じる。
 */
export default function SiteHeader(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const loginRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /** ヘッダー外クリックでドロップダウンを閉じる。 */
    function handleClick(e: MouseEvent): void {
      if (loginRef.current && !loginRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <header className="site-header">
      <Link className="logo" href="/site" style={{ cursor: "pointer", textDecoration: "none" }}>
        <img className="logo-img" src="/site/QOLC_rogo2.png" alt="QOLC" />
        <div className="logo-sub">コルク</div>
      </Link>
      <nav className="header-nav">
        <a href="#features-section">サービスのご案内</a>
        <a href="#pricing-section">料金プラン</a>
        <a href="#faq-section">よくあるご質問</a>
      </nav>
      <div className="header-right">
        <Link className="header-apply" href="/apply">
          加盟店申請
        </Link>
        <div className="header-login" ref={loginRef}>
          <button
            className="header-login-btn"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            ログイン
          </button>
          <div className={`login-dropdown${open ? " open" : ""}`}>
            <a className="login-dropdown-item" href={`${APP_URL}/facility`}>
              <div className="login-dropdown-icon" style={{ background: "#E8F5EE", color: "#2D5C40" }}>
                🏠
              </div>
              <div>
                <div className="login-dropdown-text">施設ポータル</div>
                <div className="login-dropdown-sub">介護施設の管理者・スタッフ</div>
              </div>
            </a>
            <a className="login-dropdown-item" href={`${APP_URL}/user`}>
              <div className="login-dropdown-icon" style={{ background: "#FFF5EB", color: "#C47020" }}>
                👨‍👩‍👧
              </div>
              <div>
                <div className="login-dropdown-text">ご家族ポータル</div>
                <div className="login-dropdown-sub">LINE Login / メールでログイン</div>
              </div>
            </a>
            <a className="login-dropdown-item" href={`${APP_URL}/provider`}>
              <div className="login-dropdown-icon" style={{ background: "#E8F5EE", color: "#2D5C40" }}>
                🏥
              </div>
              <div>
                <div className="login-dropdown-text">提供者ポータル</div>
                <div className="login-dropdown-sub">訪問診療・薬局・タクシー等</div>
              </div>
            </a>
            <div className="login-dropdown-divider" />
            <a className="login-dropdown-item" href={`${APP_URL}/admin`}>
              <div className="login-dropdown-icon" style={{ background: "#F0EDE8", color: "#777" }}>
                ⚙️
              </div>
              <div>
                <div className="login-dropdown-text">管理者ログイン</div>
                <div className="login-dropdown-sub">UD運営管理（MFA必須）</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
