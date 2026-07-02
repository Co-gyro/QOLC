"use client";

import { useState } from "react";
import type { JSX } from "react";
import LandingView from "./_components/LandingView";
import ConsultForm from "./_components/ConsultForm";

/** 表示中のビュー（LP／相談フォーム） */
type View = "lp" | "form";

/**
 * JCB総合窓口LP（qolc.jp/jcb）。
 * ワイヤーフレーム jcb-lp-wireframe.html を忠実に移植。
 * LP・相談フォーム・完了画面をクライアント状態で切り替える
 * （バックエンド連携なし。送信は同ページ内で完了表示に切り替わる）。
 */
export default function JcbLanding(): JSX.Element {
  const [view, setView] = useState<View>("lp");

  /** 相談フォームを開く（先頭へスクロール） */
  const openForm = (): void => {
    setView("form");
    window.scrollTo(0, 0);
  };

  /** LPへ戻る（先頭へスクロール） */
  const backToTop = (): void => {
    setView("lp");
    window.scrollTo(0, 0);
  };

  return (
    <main className="jcb-root">
      {view === "form" && (
        <header className="site-header">
          <div className="header-inner">
            <button
              type="button"
              className="brand"
              onClick={backToTop}
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <span className="logo">Q</span>
              <span>
                <span className="b-name">QOLC</span>
                <span className="b-sub">無料ご相談フォーム</span>
              </span>
            </button>
          </div>
        </header>
      )}

      {view === "lp" ? (
        <LandingView onConsult={openForm} />
      ) : (
        <ConsultForm onBackToTop={backToTop} />
      )}

      {view === "form" && (
        <footer className="site-footer">
          <div className="footer-inner">
            <div className="foot-bottom">
              <span>
                <a href="#" style={{ color: "rgba(255,255,255,0.5)" }}>
                  プライバシーポリシー
                </a>
                &nbsp;
                <a href="#" style={{ color: "rgba(255,255,255,0.5)" }}>
                  会社概要
                </a>
              </span>
              <span>&copy; 2026 Universal Development Co., Ltd.</span>
            </div>
          </div>
        </footer>
      )}
    </main>
  );
}
