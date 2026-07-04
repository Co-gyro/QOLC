"use client";

import { useState } from "react";
import type { JSX } from "react";
import SiteHeader from "../_components/SiteHeader";
import SiteFooter from "../_components/SiteFooter";
import ContactFormView from "./_components/ContactForm";

/**
 * 一般お問い合わせページ（公開・ログイン不要）。
 * お問い合わせフォームを表示し、送信成功後は同ページ内で完了表示へ切り替える
 * （/site/apply の page-apply / page-complete と同じ構成）。
 */
export default function ContactPage(): JSX.Element {
  const [completed, setCompleted] = useState(false);

  return (
    <main className="site-root">
      <SiteHeader />

      {completed ? (
        <ContactComplete />
      ) : (
        <>
          <div className="apply-hero">
            <h1>お問い合わせ</h1>
            <p>
              QOLCのサービス内容・導入のご相談・取材や提携のご依頼など、
              <br />
              お気軽にお問い合わせください。
            </p>
          </div>

          <div className="apply-note">
            <strong>ログイン不要</strong>で送信できます。
            担当スタッフが内容を確認し、<strong>2営業日以内</strong>にメールまたはお電話でご連絡いたします。
          </div>

          <ContactFormView onComplete={() => setCompleted(true)} />
        </>
      )}

      <SiteFooter />
    </main>
  );
}

/** お問い合わせ完了表示（apply の page-complete と同パターン）。 */
function ContactComplete(): JSX.Element {
  return (
    <div className="apply-complete">
      <div className="apply-complete-icon">✓</div>
      <h2>お問い合わせを受け付けました</h2>
      <p>
        ご入力いただいたメールアドレスに受付確認メールをお送りしました。
        <br />
        <strong>2営業日以内に担当スタッフよりメールまたはお電話でご連絡</strong>
        いたします。今しばらくお待ちください。
      </p>
      <div className="apply-complete-flow">
        <div className="apply-complete-flow-title">今後の流れ</div>
        {[
          ["受付確認メールの送信", "自動返信メールが届かない場合は迷惑メールフォルダをご確認ください"],
          ["担当者からのご連絡", "内容を確認のうえ、2営業日以内にご回答いたします"],
          ["ご相談・ご案内", "導入のご相談は資料のご案内やオンライン説明も可能です"],
        ].map(([title, desc], i) => (
          <div className="apply-complete-step" key={title}>
            <div className={`apply-complete-num${i === 0 ? " warm" : ""}`}>{i + 1}</div>
            <div>
              <span className="apply-complete-step-title">{title}</span>
              <br />
              <span className="apply-complete-step-desc">{desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
