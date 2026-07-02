import Link from "next/link";
import type { JSX } from "react";
import SiteHeader from "./_components/SiteHeader";
import PersonaTabs from "./_components/PersonaTabs";
import FeatureCards from "./_components/FeatureCards";
import FaqSection from "./_components/FaqSection";
import SiteFooter from "./_components/SiteFooter";

/**
 * QOLC 紹介サイト トップ（qolc.jp）。
 * ワイヤーフレーム(qolc-promo-wireframe.html)を忠実に移植した本番ページ。
 * インタラクティブ部品（ヘッダー/ペルソナ/FAQ）は client component に分離。
 */
export default function MarketingHome(): JSX.Element {
  return (
    <main className="site-root">
      <SiteHeader />

      {/* ====== HERO ====== */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-content">
          <div className="hero-badge">介護施設向け カード決済管理システム</div>
          <h1>
            施設の決済業務を<br />
            <span className="accent">まるごとスマート</span>に
          </h1>
          <p className="hero-sub">
            訪問診療・薬局・タクシーなど<br />
            入居者様の自己負担額をカード自動決済。<br />
            ご家族はLINEで明細をリアルタイム確認。
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/apply" className="btn-hero">初期費用0円で始める →</Link>
          </div>
          <p className="hero-note">初期費用0円 ・ 月額固定費0円 ・ 最短2週間で導入</p>
        </div>
      </section>

      {/* ====== CYCLE DIAGRAM ====== */}
      <section className="cycle-section">
        <div className="cycle-layout">
          <div className="cycle-text-side">
            <p className="section-label">How it works</p>
            <h2 className="section-title">
              介護施設・ご家族・サービス提供者<br />
              全員がラクになる仕組み
            </h2>
            <p className="section-sub">QOLCが決済業務をまるごとお手伝いします</p>

            <div className="cycle-points">
              <div className="cycle-point">
                <div className="cycle-point-icon" style={{ background: "linear-gradient(135deg,#E8F5EE,#D0EBD9)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D5C40" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div>
                  <div className="cycle-point-title">介護施設</div>
                  <div className="cycle-point-desc">明細を登録するだけ。立替・現金集金がゼロに。事務工数を大幅削減し、問い合わせ対応も減少します。</div>
                </div>
              </div>
              <div className="cycle-point">
                <div className="cycle-point-icon" style={{ background: "linear-gradient(135deg,#FFF5EB,#FFECDA)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C47020" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div>
                  <div className="cycle-point-title">ご家族</div>
                  <div className="cycle-point-desc">LINEで明細をリアルタイム確認。「何に使った？」の不安が解消。明細の透明性が高まり、現金の手間もなくなります。</div>
                </div>
              </div>
              <div className="cycle-point">
                <div className="cycle-point-icon" style={{ background: "linear-gradient(135deg,#E8F5EE,#D0EBD9)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D5C40" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <div>
                  <div className="cycle-point-title">サービス提供者</div>
                  <div className="cycle-point-desc">カード決済で未収金ゼロ、確実な入金を実現。明細アップロードだけのシンプル運用。</div>
                </div>
              </div>
            </div>
          </div>

          <div className="cycle-img-side">
            <img className="cycle-concept-img" src="/site/QOLC_concept2.png" alt="QOLCの概念図 — 施設利用者・介護施設・サービス提供者をQOLCがつなぐ循環図" />
          </div>
        </div>
      </section>

      {/* ====== PAIN ====== */}
      <div className="split">
        <img className="split-img" src="/site/worries1.png" alt="事務作業のイメージ" />
        <div className="split-text">
          <p className="section-label">Challenges</p>
          <h2 className="section-title">こんなお悩み<br />ありませんか？</h2>
          <p className="section-sub">施設の事務スタッフ様のよくあるお声</p>
          <div className="pain-list">
            <div className="pain-item"><div className="pain-dot" />毎月の立替精算・現金集金が大変</div>
            <div className="pain-item"><div className="pain-dot" />請求明細の作成・郵送に時間がかかる</div>
            <div className="pain-item"><div className="pain-dot" />ご家族から「何に使ったの？」と問い合わせが多い</div>
            <div className="pain-item"><div className="pain-dot" />サービス提供者ごとの入金管理が煩雑</div>
          </div>
        </div>
      </div>

      {/* ====== SOLUTION ====== */}
      <section className="section" style={{ background: "var(--green-bg)" }}>
        <p className="section-label" style={{ textAlign: "center" }}>Solution</p>
        <h2 className="section-title" style={{ textAlign: "center" }}>QOLCが<br />すべて解決します</h2>
        <p className="section-sub" style={{ textAlign: "center" }}>たった3ステップでカンタン運用</p>

        <div className="solution-steps">
          <div className="solution-step">
            <div className="solution-step-num">1</div>
            <div className="solution-step-content">
              <div className="solution-step-icon">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></svg>
              </div>
              <strong>明細を登録</strong>
              <span>サービス提供者からの明細をCSVアップロード、または管理画面から手入力。まとめて登録できます。</span>
            </div>
          </div>
          <div className="solution-step">
            <div className="solution-step-num">2</div>
            <div className="solution-step-content">
              <div className="solution-step-icon">
                <svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2.5" /><line x1="1" y1="10" x2="23" y2="10" /><line x1="6" y1="15" x2="10" y2="15" strokeWidth="1.8" /></svg>
              </div>
              <strong>自動でカード決済</strong>
              <span>登録済みのクレジットカードで自動引き落とし。施設の立替・現金集金が不要になります。</span>
            </div>
          </div>
          <div className="solution-step">
            <div className="solution-step-num">3</div>
            <div className="solution-step-content">
              <div className="solution-step-icon">
                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h4" strokeWidth="1.2" /></svg>
              </div>
              <strong>LINEで自動通知</strong>
              <span>決済完了と同時にご家族のLINEへ明細を自動送信。「何に使ったの？」の問い合わせが激減します。</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FEATURES ====== */}
      <FeatureCards />

      {/* ====== PERSONAS ====== */}
      <section className="section personas">
        <p className="section-label">Benefits</p>
        <h2 className="section-title" style={{ textAlign: "left" }}>それぞれのメリット</h2>
        <div className="section-sub" />
        <PersonaTabs />
      </section>

      {/* ====== STATS ====== */}
      <section className="stats">
        <div className="stats-bg" />
        <div className="stats-content">
          <p className="section-label" style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>Numbers</p>
          <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 24 }}>導入施設の実感</h2>
          <div className="stats-grid">
            <div><div className="stat-num">98<span>%</span></div><div className="stat-label">業務削減実感</div></div>
            <div><div className="stat-num">0<span>円</span></div><div className="stat-label">未収金</div></div>
            <div><div className="stat-num">24<span>h</span></div><div className="stat-label">明細確認</div></div>
            <div><div className="stat-num">5<span>分</span></div><div className="stat-label">月次処理</div></div>
          </div>
        </div>
      </section>

      {/* ====== TESTIMONIALS ====== */}
      <section className="section testimonials">
        <p className="section-label" style={{ textAlign: "center" }}>Voice</p>
        <h2 className="section-title" style={{ textAlign: "center" }}>ご利用者様の声</h2>
        <p className="section-sub" style={{ textAlign: "center" }}>導入施設の担当者様・ご家族からのお声</p>

        <div className="testimonial-grid">
          <div className="testimonial-card">
            <p className="testimonial-quote">現金の集金業務がなくなり、月末の事務作業が劇的に減りました。ご家族からの問い合わせも、LINEで確認できるようになってからほぼゼロです。</p>
            <div className="testimonial-author">
              <div className="testimonial-avatar"><img src="/site/keiri-bucho.png" alt="S様" /></div>
              <div>
                <div className="testimonial-name">S様</div>
                <div className="testimonial-role">有料老人ホーム 事務長</div>
                <div className="testimonial-badge">事務工数 80%削減</div>
              </div>
            </div>
          </div>
          <div className="testimonial-card">
            <p className="testimonial-quote">離れて暮らしている母が何にお金を使ったのか、LINEですぐ分かるので安心です。領収書もスマホで見られて助かっています。</p>
            <div className="testimonial-author">
              <div className="testimonial-avatar"><img src="/site/musuko1.png" alt="T様" /></div>
              <div>
                <div className="testimonial-name">T様</div>
                <div className="testimonial-role">入居者ご家族（50代）</div>
                <div className="testimonial-badge">明細確認が即時に</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== PRICING ====== */}
      <section className="section pricing" id="pricing-section" style={{ textAlign: "center" }}>
        <p className="section-label">Pricing</p>
        <h2 className="section-title" style={{ textAlign: "center" }}>ご利用料金</h2>
        <p className="section-sub" style={{ textAlign: "center" }}>始めやすく、続けやすい料金体系</p>

        <div className="pricing-hero">
          <div className="pricing-zero-card">
            <div className="pricing-zero-label">初期費用</div>
            <div className="pricing-zero-num">0<span>円</span></div>
            <div className="pricing-zero-sub">導入費用なし</div>
          </div>
          <div className="pricing-zero-card">
            <div className="pricing-zero-label">月額固定費</div>
            <div className="pricing-zero-num">0<span>円</span></div>
            <div className="pricing-zero-sub">ランニングコスト不要</div>
          </div>
        </div>

        <div className="pricing-fee-section">
          <div className="pricing-fee-header">お支払いは決済手数料のみ</div>
          <div className="pricing-fee-main">1.9<span>%〜</span></div>
          <div className="pricing-fee-note">取引規模に応じたプランをご用意</div>

          <div className="pricing-fee-tiers">
            <div className="pricing-fee-tier"><span>〜100万</span><strong>3.0%</strong></div>
            <div className="pricing-fee-tier"><span>100〜500万</span><strong>2.5%</strong></div>
            <div className="pricing-fee-tier"><span>500万〜</span><strong>1.9%〜</strong></div>
          </div>

          <div className="pricing-includes">
            <span className="pricing-includes-item"><span className="pf-c">✓</span>管理画面</span>
            <span className="pricing-includes-item"><span className="pf-c">✓</span>LINE通知</span>
            <span className="pricing-includes-item"><span className="pf-c">✓</span>導入サポート</span>
            <span className="pricing-includes-item"><span className="pf-c">✓</span>専任CS</span>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <Link href="/apply" className="btn-green" style={{ justifyContent: "center" }}>無料で見積りを依頼する →</Link>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>オンラインデモ・導入相談も無料で承ります</p>
          <p style={{ fontSize: 11, color: "var(--text-light)", marginTop: 4 }}>※ 料率は取り扱い規模（入居者数・月間決済額）に応じて変動します。詳しくはお気軽にご相談ください。</p>
        </div>
      </section>

      {/* ====== ONBOARDING FLOW ====== */}
      <section className="section onboarding">
        <p className="section-label" style={{ textAlign: "center" }}>Flow</p>
        <h2 className="section-title" style={{ textAlign: "center" }}>導入の流れ</h2>
        <p className="section-sub" style={{ textAlign: "center" }}>お問い合わせから最短2週間で利用開始</p>

        <div className="onboarding-timeline">
          <div className="onboarding-step">
            <div className="onboarding-step-dot"><div className="onboarding-step-dot-inner" /></div>
            <div className="onboarding-step-body">
              <div className="onboarding-step-title">お問い合わせ・ヒアリング</div>
              <div className="onboarding-step-desc">施設の規模や利用サービスをお聞きし、最適なプランをご提案します。オンラインデモも可能です。</div>
              <div className="onboarding-step-time">1〜2日</div>
            </div>
          </div>
          <div className="onboarding-step">
            <div className="onboarding-step-dot"><div className="onboarding-step-dot-inner" /></div>
            <div className="onboarding-step-body">
              <div className="onboarding-step-title">加盟店申請・審査</div>
              <div className="onboarding-step-desc">JCB・セゾンの包括加盟店契約により、施設様の手続きは最小限。QOLCが申請をサポートします。</div>
              <div className="onboarding-step-time">約1週間</div>
            </div>
          </div>
          <div className="onboarding-step">
            <div className="onboarding-step-dot"><div className="onboarding-step-dot-inner" /></div>
            <div className="onboarding-step-body">
              <div className="onboarding-step-title">初期設定・研修</div>
              <div className="onboarding-step-desc">管理画面の設定、入居者様のカード登録、スタッフ向け操作研修を実施します。</div>
              <div className="onboarding-step-time">2〜3日</div>
            </div>
          </div>
          <div className="onboarding-step">
            <div className="onboarding-step-dot"><div className="onboarding-step-dot-inner" /></div>
            <div className="onboarding-step-body">
              <div className="onboarding-step-title">利用開始</div>
              <div className="onboarding-step-desc">運用開始後も専任のカスタマーサクセスが伴走。困ったことがあればいつでもサポートします。</div>
            </div>
          </div>
        </div>

        <div className="onboarding-note">
          <div className="onboarding-note-big">最短2<span style={{ fontSize: 16, fontWeight: 500 }}>週間</span></div>
          <div className="onboarding-note-text">お問い合わせから利用開始まで</div>
        </div>
      </section>

      {/* ====== FAQ ====== */}
      <FaqSection />

      {/* ====== FINAL CTA ====== */}
      <section className="final-cta">
        <div className="final-cta-bg" />
        <img className="final-cta-concierge" src="/site/concierge_2.png" alt="" />
        <div className="final-cta-content">
          <h2>初期費用0円で<br />始めませんか？</h2>
          <p>導入事例のご紹介・オンラインデモ・お見積りまで、すべて無料です</p>
          <Link href="/apply" className="btn-white">無料で相談する →</Link>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 12 }}>または</p>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 700, marginTop: 4 }}>お電話: 03-6281-8882</p>
          <p className="cta-note" style={{ color: "rgba(255,255,255,0.5)" }}>平日 9:00〜18:00</p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
