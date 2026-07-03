"use client";

import { useRef, useState } from "react";
import type { JSX } from "react";
import LandingView from "./_components/LandingView";
import ConsultForm from "./_components/ConsultForm";

/** 表示中のビュー（LP／相談フォーム） */
type View = "lp" | "form";

/**
 * JCB総合窓口LP（qolc.jp/jcb）。
 * ワイヤーフレーム jcb-lp-wireframe.html を忠実に移植。
 * LP・相談フォーム・完了画面をクライアント状態で切り替える。
 * フォームからLPへ戻る動線を用意し、入力途中の場合は破棄確認のポップアップを表示する。
 */
export default function JcbLanding(): JSX.Element {
  const [view, setView] = useState<View>("lp");
  const [confirmBack, setConfirmBack] = useState(false);
  /** フォームに入力があるか（破棄確認の要否判定） */
  const formDirtyRef = useRef(false);

  /** 相談フォームを開く（先頭へスクロール） */
  const openForm = (): void => {
    formDirtyRef.current = false;
    setView("form");
    window.scrollTo(0, 0);
  };

  /** 実際にLPへ戻る（確認後・または未入力時） */
  const doBackToTop = (): void => {
    formDirtyRef.current = false;
    setConfirmBack(false);
    setView("lp");
    window.scrollTo(0, 0);
  };

  /** LPへ戻る要求。入力があれば破棄確認、無ければ即戻る */
  const requestBackToTop = (): void => {
    if (formDirtyRef.current) {
      setConfirmBack(true);
    } else {
      doBackToTop();
    }
  };

  return (
    <main className="jcb-root">
      {view === "form" && (
        <header className="site-header">
          <div className="header-inner">
            <button
              type="button"
              className="brand"
              onClick={requestBackToTop}
              style={{ background: "none", border: "none", cursor: "pointer" }}
              aria-label="LPに戻る"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo-img" src="/site/jcb/QOLC_rogo2.png" alt="QOLC" />
              <span className="brand-divider" aria-hidden="true" />
              <span className="b-sub">無料ご相談フォーム</span>
            </button>
            <button
              type="button"
              className="form-back-link"
              onClick={requestBackToTop}
            >
              &larr; LPに戻る
            </button>
          </div>
        </header>
      )}

      {view === "lp" ? (
        <LandingView onConsult={openForm} />
      ) : (
        <ConsultForm
          onBackToTop={doBackToTop}
          onRequestBack={requestBackToTop}
          onDirtyChange={(dirty) => {
            formDirtyRef.current = dirty;
          }}
        />
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

      {confirmBack && (
        <div
          className="jcb-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jcb-modal-title"
          onClick={() => setConfirmBack(false)}
        >
          <div className="jcb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="jcb-modal-title" className="jcb-modal-title">
              入力を中断してLPに戻りますか？
            </h3>
            <p className="jcb-modal-body">
              入力された内容は保存されず、破棄されます。よろしいですか？
            </p>
            <div className="jcb-modal-actions">
              <button
                type="button"
                className="jcb-modal-cancel"
                onClick={() => setConfirmBack(false)}
              >
                入力を続ける
              </button>
              <button
                type="button"
                className="jcb-modal-confirm"
                onClick={doBackToTop}
              >
                破棄して戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
