"use client";

import Link from "next/link";
import type { JSX } from "react";
import FacilitiesCarousel from "./FacilitiesCarousel";
import {
  CardIcon,
  HomeIcon,
  ClipboardIcon,
  HeartIcon,
  ShieldIcon,
  CheckCircleIcon,
  PersonIcon,
  CardBadgeIcon,
} from "./icons";

/** お悩み（共感）カードの文言 */
const WORRIES = [
  "親の今後の暮らしについて、漠然とした不安がある",
  "一人暮らしの家族が心配で、住み替えを検討したい",
  "将来の住み替え先を、早めに探しておきたい",
  "引っ越しや片付けなど、住み替えの段取りが大変そう",
] as const;

/**
 * ランディングページ本体（LP全セクション）。
 * 各CTAは相談フォーム表示（onConsult）へ遷移する。
 * @param onConsult 相談フォームを表示する操作
 */
export default function LandingView({
  onConsult,
}: {
  onConsult: () => void;
}): JSX.Element {
  return (
    <>
      {/* HEADER */}
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top">
            <span className="brand-logo-mark" role="img" aria-label="QOLC" />
            <span className="brand-divider" aria-hidden="true" />
            <span className="b-sub">
              シニアの住まいの相談窓口 / JCB &times; Universal Development
            </span>
          </a>
          <button
            type="button"
            className="btn header-cta"
            onClick={onConsult}
          >
            ご相談
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="hero" id="top">
        <div className="hero-photo" />
        <div className="hero-inner">
          <div className="hero-col">
            <span className="hero-badge">
              <span className="dot" />
              JCBカードホルダー様 限定ご案内
            </span>
            <div className="hero-credit-badge">
              <CardIcon />
              クレジットカード決済対応のシニアレジデンスをご紹介
            </div>
            <h1>
              将来の暮らしに
              <br />
              <span className="amp">確かな安心</span>を。
            </h1>
            <p className="hero-sub">住み替えのご不安に、寄り添います。</p>
            <div className="hero-actions">
              <button type="button" className="btn btn-gold" onClick={onConsult}>
                無料でご相談する <span className="arrow">&rarr;</span>
              </button>
              <span className="hero-note">
                所要時間 約2分<span className="sep">&middot;</span>秘密厳守
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="trustbar">
        <div className="trustbar-inner">
          {["ご相談無料", "秘密厳守", "専任コンシェルジュ対応"].map((t) => (
            <span className="item" key={t}>
              <span className="dot" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* SERVICES（コンシェルジュ背景型） */}
      <section className="section bg-cream svc-section">
        <div className="svc-bg-person" />
        <div className="section-inner">
          <div className="section-head">
            <span className="eyebrow">Relocation Support</span>
            <h2>住み替えトータルサポート</h2>
            <p>
              「どこに相談すればいいか分からない」という不安に、
              <br />
              専任コンシェルジュが寄り添います。
            </p>
          </div>
          <div className="svc-grid">
            <article className="svc-card">
              <span className="svc-ico" aria-hidden="true">
                <HomeIcon />
              </span>
              <div>
                <h3>シニアレジデンスのご紹介</h3>
                <p>
                  お体の状態やご希望に合った、上質な住まいを厳選してご案内いたします。見学の手配もお任せください。
                </p>
              </div>
            </article>
            <article className="svc-card">
              <span className="svc-ico" aria-hidden="true">
                <ClipboardIcon />
              </span>
              <div>
                <h3>住み替えプランニング</h3>
                <p>
                  時期・エリア・ご予算など、漠然としたお悩みの段階からご一緒に整理いたします。
                </p>
              </div>
            </article>
            <article className="svc-card">
              <span className="svc-ico" aria-hidden="true">
                <HeartIcon />
              </span>
              <div>
                <h3>住み替え後のアフターフォロー</h3>
                <p>
                  お引っ越しの手配から、新しい暮らしに安心して馴染めるまでの見守り・生活サポートを継続的にご提供します。
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 提携施設紹介 */}
      <section className="section facilities-section">
        <div className="section-inner">
          <div className="section-head">
            <span className="eyebrow">Partner Residences</span>
            <h2>提携シニアレジデンス</h2>
            <p>
              クレジットカード決済に対応した、厳選の提携施設をご紹介します。
            </p>
          </div>
          <FacilitiesCarousel />
        </div>
      </section>

      {/* WORRY / EMPATHY */}
      <section className="section bg-white">
        <div className="section-inner">
          <div className="section-head">
            <span className="eyebrow">Your Concerns</span>
            <h2>
              こんなお悩み、
              <br />
              抱えていませんか。
            </h2>
          </div>
          <div className="worry-grid">
            {WORRIES.map((w) => (
              <div className="worry-card" key={w}>
                <span className="dia" />
                <p>{w}</p>
              </div>
            ))}
            <div className="worry-card" style={{ gridColumn: "1/-1" }}>
              <span className="dia" />
              <p>何から始めればいいのか分からない</p>
            </div>
          </div>
          <div className="worry-cta">
            <button type="button" className="btn btn-gold" onClick={onConsult}>
              まずは無料でご相談する <span className="arrow">&rarr;</span>
            </button>
          </div>
        </div>
      </section>

      {/* FLOW */}
      <section className="section bg-cream">
        <div className="section-inner">
          <div className="section-head">
            <span className="eyebrow">Flow</span>
            <h2>ご相談の流れ</h2>
            <p>かんたん3ステップ。ご相談はすべて無料です。</p>
          </div>
          <div className="flow">
            {[
              {
                n: "1",
                h: "フォームでお気持ちを共有",
                p: "チェックを選ぶだけ。約2分で完了します。",
              },
              {
                n: "2",
                h: "専任コンシェルジュがご連絡",
                p: "ご希望の時間帯に、お電話でていねいにヒアリングいたします。",
              },
              {
                n: "3",
                h: "最適なプランをご提案",
                p: "お一人おひとりに合わせたサービスをご案内します。",
              },
            ].map((s) => (
              <div className="flow-step" key={s.n}>
                <span className="flow-num">{s.n}</span>
                <div>
                  <h3>{s.h}</h3>
                  <p>{s.p}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROMISE / TRUST */}
      <section className="section bg-white">
        <div className="section-inner">
          <div className="section-head">
            <span className="eyebrow">Our Promise</span>
            <h2>安心のお約束</h2>
          </div>
          <div className="promise-grid">
            <div className="promise-card">
              <span className="promise-ico">
                <ShieldIcon />
              </span>
              <h3>
                個人情報の
                <br />
                厳重な保護
              </h3>
              <p>SSL暗号化通信で、安全に送信されます。</p>
            </div>
            <div className="promise-card">
              <span className="promise-ico">
                <CheckCircleIcon />
              </span>
              <h3>
                ご相談は
                <br />
                完全無料
              </h3>
              <p>何度でも無料で、ご相談いただけます。</p>
            </div>
            <div className="promise-card">
              <span className="promise-ico">
                <PersonIcon />
              </span>
              <h3>
                専任コンシェルジュ
                <br />
                対応
              </h3>
              <p>経験豊富な専任スタッフが、最後まで担当します。</p>
            </div>
            <div className="promise-card">
              <span className="promise-ico">
                <CardBadgeIcon />
              </span>
              <h3>
                JCBとの
                <br />
                提携サービス
              </h3>
              <p>JCBカードホルダー様への、特別なご案内です。</p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final" id="form-section">
        <div className="final-photo" />
        <div className="final-inner">
          <span className="eyebrow">Contact</span>
          <h2>
            まずはお気軽に
            <br />
            ご相談ください。
          </h2>
          <p>
            ご相談は無料・秘密厳守。専任コンシェルジュが、あなたの「これから」に寄り添います。
          </p>
          <button
            type="button"
            className="btn btn-gold"
            style={{ minWidth: 280, justifyContent: "center" }}
            onClick={onConsult}
          >
            無料でご相談する <span className="arrow">&rarr;</span>
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="foot-top">
            <div>
              <div className="foot-brand">
                JCB <span>&times;</span> Universal Development
              </div>
              <p className="foot-tag">
                JCBカードホルダー様向け
                シニアの住まいの相談窓口。暮らしのご相談を、ワンストップで承ります。
              </p>
            </div>
            <nav className="foot-nav">
              <Link href="/">QOLCトップ</Link>
              <a href="#">プライバシーポリシー</a>
              <a href="#">特定商取引法に基づく表記</a>
              <a href="#">会社概要</a>
            </nav>
          </div>
          <div className="foot-bottom">
            <span>&copy; 2026 Universal Development Co., Ltd.</span>
            <span>運営：株式会社ユニバーサルデベロップメント</span>
          </div>
        </div>
      </footer>
    </>
  );
}
