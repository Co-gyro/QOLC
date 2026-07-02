import type { JSX } from "react";

/** 特長カード1件。 */
interface Feature {
  readonly icon: JSX.Element;
  readonly title: string;
  readonly body: string;
  readonly tags?: readonly string[];
}

/** QOLCの特長6機能（ワイヤーの文言・アイコン・タグをそのまま移植）。 */
const FEATURES: readonly Feature[] = [
  {
    icon: (
      <svg viewBox="0 0 24 24">
        <ellipse cx="12" cy="6" rx="7.5" ry="3" />
        <path d="M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" />
        <path d="M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
      </svg>
    ),
    title: "現金管理の解消",
    body: "施設での現金の集金・立替・保管が不要に。金銭事故のリスクや、日々の現金管理にかかる手間から解放されます。",
    tags: ["立替ゼロ", "金銭事故リスク低減"],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="2" y="5" width="20" height="14" rx="2.5" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <circle cx="7" cy="15" r="1.2" fill="#3D7A55" stroke="none" />
        <circle cx="10.5" cy="15" r="1.2" fill="#3D7A55" stroke="none" />
      </svg>
    ),
    title: "カード決済",
    body: "ご家族のクレジットカードで自動決済。主要な国際ブランドに幅広く対応し、対面・郵送不要でスムーズにお支払いいただけます。",
    tags: ["Visa", "Mastercard", "JCB", "アメックス", "ダイナース"],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
        <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
      </svg>
    ),
    title: "レセコン連携",
    body: "お使いのレセコンから出力したCSVをアップロードするだけ。QOLCが自動で照合し、利用明細を作成します。請求書・領収書の郵送も不要になります。",
    tags: ["CSVアップロード", "自動照合", "郵送物ゼロ"],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 9h8M8 13h4" strokeWidth="1.2" />
      </svg>
    ),
    title: "LINE通知 & Webポータル",
    body: "決済完了後、ご家族にLINEで自動通知。スマホから領収書のダウンロードもできます。「何に使ったの？」の問い合わせが激減。",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" strokeWidth="1.8" />
      </svg>
    ),
    title: "セキュリティ万全",
    body: "SSL暗号化通信・カード番号非保持。USEN FinTechの堅牢な決済インフラで安心してご利用いただけます。",
    tags: ["カード番号非保持", "SSL暗号化"],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeDasharray="2 2" />
      </svg>
    ),
    title: "かんたん導入・専任サポート",
    body: "既存業務を大きく変えず導入OK。専任のカスタマーサクセスが導入前から運用後まで伴走します。",
  },
];

/** QOLCの特長カードグリッド（静的）。 */
export default function FeatureCards(): JSX.Element {
  return (
    <section className="section features" id="features-section">
      <p className="section-label" style={{ textAlign: "center" }}>Features</p>
      <h2 className="section-title" style={{ textAlign: "center" }}>QOLCの特長</h2>
      <p className="section-sub" style={{ textAlign: "center" }}>
        安全・簡単・透明な決済管理を実現する6つの機能
      </p>

      <div className="feature-grid">
        {FEATURES.map((f) => (
          <div className="feature-card" key={f.title}>
            <div className="feature-card-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
            {f.tags && (
              <div className="feature-card-tags">
                {f.tags.map((t) => (
                  <span className="feature-card-tag" key={t}>{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
