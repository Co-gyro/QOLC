import Link from "next/link";

/**
 * QOLC 紹介サイト トップ（qolc.jp）。
 * B1: 土台確認用スケルトン（ヒーロー＋主要導線）。以降のフェーズで
 * ワイヤーフレーム（qolc-promo）を忠実に各セクションへ拡張する。
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qolc.jp";

export default function MarketingHome() {
  return (
    <main>
      {/* ヘッダー */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid #E0DDD8",
          position: "sticky",
          top: 0,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(6px)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 900, color: "#4C986A" }}>
            QOLC
          </span>
          <span style={{ fontSize: 13, color: "#777" }}>コルク</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a
            href={`${APP_URL}/login`}
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#4C986A",
              textDecoration: "none",
              padding: "10px 18px",
              border: "1.5px solid #4C986A",
              borderRadius: 8,
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ログイン
          </a>
        </nav>
      </header>

      {/* ヒーロー */}
      <section
        style={{
          background:
            "linear-gradient(160deg, #F0F9F4 0%, #ffffff 60%)",
          padding: "72px 24px 88px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 13,
            letterSpacing: 2,
            color: "#4C986A",
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          介護施設向け キャッシュレス決済サービス
        </p>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 900,
            lineHeight: 1.5,
            color: "#333",
            maxWidth: 720,
            margin: "0 auto 20px",
          }}
        >
          入居者様の自己負担額を
          <br />
          カードで、かんたん・非対面決済。
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#555",
            maxWidth: 620,
            margin: "0 auto 32px",
          }}
        >
          現金の集金・立替・郵送物をゼロに。ご家族はLINEで明細をリアルタイム確認。
          施設の事務負担と未収リスクを大きく減らします。
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/apply"
            style={{
              background: "#4C986A",
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              padding: "14px 28px",
              borderRadius: 10,
              textDecoration: "none",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            加盟店申請する →
          </Link>
          <a
            href={`${APP_URL}/login`}
            style={{
              background: "#fff",
              color: "#4C986A",
              fontWeight: 700,
              fontSize: 16,
              padding: "14px 28px",
              borderRadius: 10,
              textDecoration: "none",
              border: "1.5px solid #4C986A",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ログイン
          </a>
        </div>
        <p style={{ fontSize: 13, color: "#888", marginTop: 18 }}>
          初期費用0円 ・ 月額固定費0円 ・ 最短2週間で導入
        </p>
      </section>

      {/* JCB向け導線 */}
      <section style={{ padding: "40px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#555" }}>
          JCBカード会員のご家族向け「住み替え相談窓口」は
          {" "}
          <Link
            href="/jcb"
            style={{ color: "#4C986A", fontWeight: 700 }}
          >
            こちら
          </Link>
        </p>
      </section>

      {/* フッター */}
      <footer
        style={{
          background: "#1F3A2B",
          color: "rgba(255,255,255,0.7)",
          padding: "32px 24px",
          textAlign: "center",
          fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 900, color: "#fff", fontSize: 20 }}>QOLC</div>
        <p style={{ marginTop: 12 }}>
          運営：ユニバーサル・デベロップメント株式会社
        </p>
        <p style={{ marginTop: 4 }}>&copy; 2026 Universal Development Co., Ltd. / qolc.jp</p>
      </footer>
    </main>
  );
}
