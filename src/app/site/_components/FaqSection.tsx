"use client";

import { useState } from "react";

/** FAQのカテゴリ種別。 */
type FaqCat = "facility" | "family" | "provider" | "security";

/** FAQ1件。 */
interface FaqEntry {
  readonly cat: FaqCat;
  readonly q: string;
  readonly a: string;
}

/** カテゴリフィルタのタブ定義（値="all"は全件表示）。 */
const CAT_TABS: ReadonlyArray<{ readonly key: "all" | FaqCat; readonly label: string }> = [
  { key: "all", label: "すべて" },
  { key: "facility", label: "施設向け" },
  { key: "family", label: "ご家族向け" },
  { key: "provider", label: "提供者向け" },
  { key: "security", label: "セキュリティ" },
];

/** FAQ全項目（ワイヤーの文言をそのまま移植）。 */
const FAQS: readonly FaqEntry[] = [
  { cat: "facility", q: "導入にどのくらい時間がかかりますか？", a: "お申し込みから最短2週間で利用開始可能です。加盟店審査（約1週間）→初期設定・スタッフ研修（2〜3日）の流れになります。" },
  { cat: "facility", q: "既存の業務フローを変える必要がありますか？", a: "いいえ。既存の明細データをCSVアップロードするだけで利用できます。手入力にも対応しており、特別なシステム連携は不要です。" },
  { cat: "facility", q: "複数施設を一括管理できますか？", a: "はい。1つの管理アカウントで複数施設の決済状況・明細を一元管理できます。施設ごとに担当者アカウントを発行することも可能です。" },
  { cat: "facility", q: "入居者全員がカードを持っている必要がありますか？", a: "いいえ。カード決済をご利用いただける入居者様から段階的に導入いただけます。カードをお持ちでない方は従来通りの方法を並行できます。" },
  { cat: "family", q: "LINEで通知を受け取るにはどうすればいいですか？", a: "施設からお送りするQRコードをLINEで読み取り、友だち追加するだけです。LINEログイン後、ご家族ポータルから明細の確認・領収書のダウンロードもできます。" },
  { cat: "family", q: "登録したカードの変更はできますか？", a: "はい。ご家族ポータルからいつでもカード情報の変更・更新が可能です。QOLCではカード番号を一切保持しないため安全です。" },
  { cat: "family", q: "利用明細はどのくらい詳しく見られますか？", a: "サービス提供者名、サービス内容、金額、利用日がすべて確認できます。PDFの領収書もダウンロード可能です。" },
  { cat: "family", q: "LINEを使っていなくても利用できますか？", a: "はい。メールアドレスでのログインにも対応しています。Webポータルから同様の機能をご利用いただけます。" },
  { cat: "provider", q: "サービス提供者として登録するにはどうすればいいですか？", a: "取引先の介護施設がQOLCを導入済みであれば、施設経由でアカウントが発行されます。ご自身での加盟店申請は不要です。" },
  { cat: "provider", q: "明細のアップロード方法は？", a: "管理画面からCSVアップロード、または手入力が可能です。複数施設分の明細をまとめてアップロードすることもできます。" },
  { cat: "provider", q: "入金サイクルはどうなりますか？", a: "カード会社の締め日・支払日に準じます。JCBは月末締め翌月末払い、セゾンは月末締め翌月末払いが基本です。" },
  { cat: "security", q: "入居者のカード情報は安全ですか？", a: "QOLCではカード番号を一切保持しません。PCI DSS準拠の決済基盤（USEN FinTech）を利用し、トークン化された情報のみ管理します。カード番号が流出するリスクはありません。" },
  { cat: "security", q: "どのクレジットカードに対応していますか？", a: "JCB、セゾン（Visa/Mastercard）をはじめ、主要ブランドに対応しています。QOLCはJCB・セゾンの包括加盟店契約を持っているため、施設様の審査がスムーズです。" },
  { cat: "security", q: "データのバックアップ体制は？", a: "クラウドサーバー上で自動バックアップを実施しています。通信はすべてSSL暗号化され、アクセス制御も厳格に管理しています。" },
  { cat: "security", q: "不正利用への対策はありますか？", a: "決済ごとに施設の承認が必要なフローのため、第三者による不正利用のリスクを最小限に抑えています。すべての決済履歴は監査ログとして記録されます。" },
];

/**
 * FAQセクション。カテゴリフィルタ（persona-tabsスタイル）と
 * アコーディオン開閉を state で制御。初期は先頭の1件を開いた状態にする。
 */
export default function FaqSection(): React.JSX.Element {
  const [cat, setCat] = useState<"all" | FaqCat>("all");
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="section faq" id="faq-section">
      <p className="section-label" style={{ textAlign: "center" }}>FAQ</p>
      <h2 className="section-title" style={{ textAlign: "center" }}>よくあるご質問</h2>
      <div className="section-sub" style={{ textAlign: "center" }} />

      <div className="persona-tabs" style={{ justifyContent: "center", marginBottom: 20 }}>
        {CAT_TABS.map((t) => (
          <div
            key={t.key}
            className={`persona-tab${cat === t.key ? " active" : ""}`}
            onClick={() => setCat(t.key)}
          >
            {t.label}
          </div>
        ))}
      </div>

      {FAQS.map((faq, i) => {
        const visible = cat === "all" || faq.cat === cat;
        if (!visible) return null;
        const open = openIdx === i;
        return (
          <div key={faq.q} className={`faq-item${open ? " open" : ""}`}>
            <div className="faq-q" onClick={() => setOpenIdx(open ? null : i)}>
              {faq.q}
            </div>
            <div className="faq-a">{faq.a}</div>
          </div>
        );
      })}
    </section>
  );
}
