import Link from "next/link";

/**
 * JCB総合窓口LP（qolc.jp/jcb）。
 * B1: 土台確認用スケルトン（ヒーロー＋導線）。以降のフェーズで
 * ワイヤーフレーム（jcb-lp）を忠実に各セクションへ拡張する。
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qolc.jp";

export default function JcbLanding() {
  return (
    <main style={{ background: "#0F1D36", color: "#fff", minHeight: "100vh" }}>
      {/* ヘッダー */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid rgba(196,162,101,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#C4A265" }}>
            QOLCの安心相談窓口
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            by JCB
          </span>
        </div>
        <Link
          href="/"
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.7)",
            textDecoration: "none",
          }}
        >
          QOLCトップ →
        </Link>
      </header>

      {/* ヒーロー */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <p
          style={{
            fontSize: 12,
            letterSpacing: 3,
            color: "#C4A265",
            fontWeight: 700,
            marginBottom: 18,
          }}
        >
          JCBカードホルダー様 限定ご案内
        </p>
        <h1
          style={{
            fontFamily: "'Noto Serif JP', serif",
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.6,
            maxWidth: 680,
            margin: "0 auto 20px",
          }}
        >
          住み替えのご不安に、
          <br />
          専任コンシェルジュが寄り添います。
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "rgba(255,255,255,0.8)",
            maxWidth: 600,
            margin: "0 auto 32px",
          }}
        >
          介護施設・シニアレジデンスへの住み替えを、プランニングからアフターフォローまで
          トータルにサポート。ご相談は無料・秘密厳守です。
        </p>
        <a
          href="#"
          style={{
            background: "#C4A265",
            color: "#0F1D36",
            fontWeight: 700,
            fontSize: 16,
            padding: "14px 30px",
            borderRadius: 10,
            textDecoration: "none",
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          無料で相談する →
        </a>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 16 }}>
          所要時間 約2分 ・ 秘密厳守
        </p>
      </section>

      {/* フッター */}
      <footer
        style={{
          borderTop: "1px solid rgba(196,162,101,0.25)",
          padding: "28px 24px",
          textAlign: "center",
          fontSize: 12,
          color: "rgba(255,255,255,0.5)",
        }}
      >
        <p>QOLCの安心相談窓口 by JCB</p>
        <p style={{ marginTop: 4 }}>
          運営：ユニバーサル・デベロップメント株式会社
        </p>
      </footer>
    </main>
  );
}
