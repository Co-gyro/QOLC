"use client";

import { useState } from "react";
import type { JSX } from "react";
import SiteHeader from "../_components/SiteHeader";
import SiteFooter from "../_components/SiteFooter";
import ApplyForm from "./_components/ApplyForm";

/**
 * 加盟店申請ページ（公開・ログイン不要）。
 * 申請フォームを表示し、送信成功後は同ページ内で完了表示へ切り替える。
 * ワイヤーフレーム qolc-promo-wireframe.html の page-apply / page-complete に準拠。
 */
export default function ApplyPage(): JSX.Element {
  const [completed, setCompleted] = useState(false);

  return (
    <main className="site-root">
      <SiteHeader />

      {completed ? (
        <ApplyComplete />
      ) : (
        <>
          <div className="apply-hero">
            <h1>加盟店申請</h1>
            <p>
              QOLCのカード決済サービスをご利用いただくための
              <br />
              加盟店登録のお申し込みフォームです。
            </p>
          </div>

          {/* 申請プロセス説明 */}
          <div className="apply-flow">
            <div className="apply-flow-title">
              <span aria-hidden>&#9432;</span> お申し込みからご利用開始までの流れ
            </div>
            <p className="apply-flow-lead">
              まずはこちらのフォームで基本情報をお送りください。
              <strong>ここでの入力内容だけで加盟店審査が行われるわけではありません。</strong>
              フォーム送信後、QOLCの担当スタッフがお電話またはメールにて詳しい内容を聞き取りさせていただきます。ヒアリングの内容をもとに、私たちがカード会社（JCB・セゾン）への正式な申請書類を作成・提出いたしますので、難しい書類作業はございません。
            </p>
            <div className="apply-flow-steps">
              {[
                ["フォーム送信", "以下の基本情報をご入力ください（3分程度）"],
                ["ヒアリング", "担当スタッフがお電話・メールで詳細をお伺いします"],
                ["審査申請", "QOLCがカード会社への申請書類を作成・提出します"],
                ["審査完了・ご利用開始", "初期設定とスタッフ研修を経てサービス開始"],
              ].map(([title, desc], i) => (
                <div className="apply-flow-step" key={title}>
                  <div className="apply-flow-num">{i + 1}</div>
                  <span>
                    <strong>{title}</strong> — {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="apply-note">
            <strong>ログイン不要</strong>で申請できます。以下の項目をご入力のうえ送信してください。
          </div>

          <ApplyForm onComplete={() => setCompleted(true)} />
        </>
      )}

      <SiteFooter />
    </main>
  );
}

/** 申請完了表示。ワイヤーフレーム page-complete 相当。 */
function ApplyComplete(): JSX.Element {
  return (
    <div className="apply-complete">
      <div className="apply-complete-icon">✓</div>
      <h2>お申し込みを受け付けました</h2>
      <p>
        ご登録いただいたメールアドレスに確認メールをお送りしました。
        <br />
        <strong>2営業日以内に担当スタッフよりお電話またはメールにてご連絡</strong>
        いたします。詳しい内容をヒアリングさせていただいたうえで、私たちがカード会社への正式な申請手続きを代行いたします。
      </p>
      <div className="apply-complete-flow">
        <div className="apply-complete-flow-title">今後の流れ</div>
        {[
          ["ヒアリングのご連絡", "担当スタッフがお電話・メールで詳細をお伺いします"],
          ["申請書類の作成・提出", "QOLCがJCB・セゾンへの申請を代行します"],
          ["審査完了のご連絡", "審査には通常1〜2週間程度かかります"],
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
