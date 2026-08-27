"use client";

import { useState } from "react";
import type { JSX } from "react";
import SiteHeader from "../../_components/SiteHeader";
import SiteFooter from "../../_components/SiteFooter";
import ApplyForm from "./ApplyForm";
import {
  APPLY_TYPE_COPY,
  MERCHANT_APPLY_TYPES,
  type MerchantApplyType,
} from "@/lib/applications/apply-type";

/**
 * 加盟店申請ページの本体（クライアント）。
 * 区分選択 → フォーム → 完了 の3状態を持つ。
 * @param initialType URL クエリで指定された区分（未指定なら選択画面から開始）
 */
export default function ApplyPageClient({
  initialType,
}: {
  initialType: MerchantApplyType | null;
}): JSX.Element {
  const [type, setType] = useState<MerchantApplyType | null>(initialType);
  const [completed, setCompleted] = useState(false);

  /** 区分を切り替える（URL も書き換えて共有・再読込に耐えるようにする）。 */
  function chooseType(next: MerchantApplyType): void {
    setType(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/apply?type=${next}`);
    }
    window.scrollTo({ top: 0 });
  }

  return (
    <main className="site-root">
      <SiteHeader />

      {completed && type ? (
        <ApplyComplete type={type} />
      ) : type === null ? (
        <ApplyTypeChooser onChoose={chooseType} />
      ) : (
        <ApplyBody type={type} onChangeType={chooseType} onComplete={() => setCompleted(true)} />
      )}

      <SiteFooter />
    </main>
  );
}

/** 入口の選択画面。介護施設向け / 一般の店舗・事業所向け を2枚のカードで提示する。 */
function ApplyTypeChooser({
  onChoose,
}: {
  onChoose: (type: MerchantApplyType) => void;
}): JSX.Element {
  return (
    <>
      <div className="apply-hero">
        <h1>加盟店申請</h1>
        <p>
          ご利用の形態をお選びください。
          <br />
          選んだ内容に合わせた申請フォームをご案内します。
        </p>
      </div>

      <div className="apply-choose">
        {MERCHANT_APPLY_TYPES.map((key) => {
          const c = APPLY_TYPE_COPY[key];
          return (
            <button
              key={key}
              type="button"
              className="apply-choose-card"
              onClick={() => onChoose(key)}
            >
              <div className="apply-choose-icon" aria-hidden>
                {c.icon}
              </div>
              <div className="apply-choose-title">{c.title}</div>
              <div className="apply-choose-tagline">{c.tagline}</div>
              <div className="apply-choose-examples">{c.examples}</div>
              <span className="apply-choose-cta">この内容で進む →</span>
            </button>
          );
        })}
      </div>

      <div className="apply-note">
        どちらか迷われる場合は<strong>一般の店舗・事業所向け</strong>
        をお選びください。ヒアリングの際に最適なプランをご案内します。
      </div>
    </>
  );
}

/** 選択済み区分の申請フォーム（説明文・注意書き込み）。 */
function ApplyBody({
  type,
  onChangeType,
  onComplete,
}: {
  type: MerchantApplyType;
  onChangeType: (type: MerchantApplyType) => void;
  onComplete: () => void;
}): JSX.Element {
  const copy = APPLY_TYPE_COPY[type];
  const other = type === "care" ? "general" : "care";

  return (
    <>
      <div className="apply-hero">
        <h1>{copy.heroTitle}</h1>
        <p>{copy.heroLead}</p>
        <button
          type="button"
          className="apply-switch"
          onClick={() => onChangeType(other)}
        >
          {APPLY_TYPE_COPY[other].title}の申請はこちら →
        </button>
      </div>

      {/* 申請プロセス説明 */}
      <div className="apply-flow">
        <div className="apply-flow-title">
          <span aria-hidden>&#9432;</span> お申し込みからご利用開始までの流れ
        </div>
        <p className="apply-flow-lead">
          まずはこちらのフォームで基本情報をお送りください。
          <strong>ここでの入力内容だけで加盟店審査が行われるわけではありません。</strong>
          フォーム送信後、担当スタッフがお電話またはメールにて詳しい内容を聞き取りさせていただきます。ヒアリングの内容をもとに、
          {copy.agentName}
          がカード会社（JCB・セゾン）への正式な申請書類を作成・提出いたしますので、難しい書類作業はございません。
        </p>
        <div className="apply-flow-steps">
          {[
            ["フォーム送信", "以下の基本情報をご入力ください（3分程度）"],
            ["ヒアリング", "担当スタッフがお電話・メールで詳細をお伺いします"],
            ["審査申請", `${copy.agentName}がカード会社への申請書類を作成・提出します`],
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

      <ApplyForm applyType={type} onComplete={onComplete} />
    </>
  );
}

/** 申請完了表示。ワイヤーフレーム page-complete 相当。 */
function ApplyComplete({ type }: { type: MerchantApplyType }): JSX.Element {
  const copy = APPLY_TYPE_COPY[type];
  return (
    <div className="apply-complete">
      <div className="apply-complete-icon">✓</div>
      <h2>お申し込みを受け付けました</h2>
      <p>
        ご登録いただいたメールアドレスに確認メールをお送りしました。
        <br />
        <strong>2営業日以内に担当スタッフよりお電話またはメールにてご連絡</strong>
        いたします。詳しい内容をヒアリングさせていただいたうえで、
        {copy.agentName}
        がカード会社への正式な申請手続きを代行いたします。
      </p>
      <div className="apply-complete-flow">
        <div className="apply-complete-flow-title">今後の流れ</div>
        {[
          ["ヒアリングのご連絡", "担当スタッフがお電話・メールで詳細をお伺いします"],
          ["申請書類の作成・提出", `${copy.agentName}がJCB・セゾンへの申請を代行します`],
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
