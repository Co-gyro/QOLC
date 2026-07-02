"use client";

import Link from "next/link";
import { useState } from "react";

/** アプリ本体のベースURL。 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qolc.jp";

/** ペルソナ別メリットのタブ（施設 / ご家族 / サービス提供者）。 */
const TABS = ["施設", "ご家族", "サービス提供者"] as const;

/** アウトラインボタン（緑枠）共通スタイル。 */
const outlineBtnStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "10px 18px",
  minHeight: 40,
  border: "1.5px solid var(--green)",
  borderRadius: 8,
  color: "var(--green)",
  fontWeight: 700,
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
};

/**
 * ペルソナ別メリットのタブ切替。選択中のカードのみ表示する。
 * 元ワイヤーの showPersona(i) を state に置換。
 */
export default function PersonaTabs(): React.JSX.Element {
  const [active, setActive] = useState(0);

  return (
    <>
      <div className="persona-tabs">
        {TABS.map((label, i) => (
          <div
            key={label}
            className={`persona-tab${active === i ? " active" : ""}`}
            onClick={() => setActive(i)}
          >
            {label}
          </div>
        ))}
      </div>

      {active === 0 && (
        <div className="persona-card">
          <img
            className="persona-card-img"
            src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80"
            alt="施設スタッフ"
          />
          <div className="persona-card-body">
            <h3>施設運営者様</h3>
            <div className="persona-benefit"><div className="p-check">✓</div>現金の取り扱い・立替がゼロに</div>
            <div className="persona-benefit"><div className="p-check">✓</div>明細作成・郵送コストを大幅削減</div>
            <div className="persona-benefit"><div className="p-check">✓</div>入金管理の自動化で事務工数を削減</div>
            <div className="persona-benefit"><div className="p-check">✓</div>ご家族からの問い合わせが激減</div>
            <div className="persona-benefit"><div className="p-check">✓</div>未収リスクがほぼゼロに</div>
            <div className="persona-benefit"><div className="p-check">✓</div>カード決済対応が、新たな入居者獲得の手段に</div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-light)" }}>
              <a href={`${APP_URL}/facility`} className="btn-green" style={{ fontSize: 13, padding: "10px 18px", minHeight: 40, flex: 1, justifyContent: "center" }}>
                施設ポータルへ
              </a>
              <Link href="/apply" style={outlineBtnStyle}>加盟店申請</Link>
            </div>
          </div>
        </div>
      )}

      {active === 1 && (
        <div className="persona-card">
          <img className="persona-card-img" src="/site/Family1.png" alt="ご家族" />
          <div className="persona-card-body">
            <h3>ご家族様</h3>
            <div className="persona-benefit"><div className="p-check">✓</div>LINEで利用明細をリアルタイム確認</div>
            <div className="persona-benefit"><div className="p-check">✓</div>何にいくら使ったか一目瞭然</div>
            <div className="persona-benefit"><div className="p-check">✓</div>スマホから領収書をダウンロード</div>
            <div className="persona-benefit"><div className="p-check">✓</div>現金のやり取り・振込の手間なし</div>
            <div className="persona-benefit"><div className="p-check">✓</div>カードポイントが貯まる</div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-light)" }}>
              <a href={`${APP_URL}/login`} className="btn-green" style={{ fontSize: 13, padding: "10px 18px", minHeight: 40, flex: 1, justifyContent: "center" }}>
                LINEでログイン
              </a>
              <a href={`${APP_URL}/login`} style={outlineBtnStyle}>メールでログイン</a>
            </div>
          </div>
        </div>
      )}

      {active === 2 && (
        <div className="persona-card">
          <img className="persona-card-img" src="/site/nursing1.png" alt="サービス提供者" />
          <div className="persona-card-body">
            <h3>サービス提供者様</h3>
            <div className="persona-benefit"><div className="p-check">✓</div>請求・入金がカード決済で確実に</div>
            <div className="persona-benefit"><div className="p-check">✓</div>未収金リスクを解消</div>
            <div className="persona-benefit"><div className="p-check">✓</div>明細アップロードだけのシンプル運用</div>
            <div className="persona-benefit"><div className="p-check">✓</div>管理画面で取引先施設を一元管理</div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-light)" }}>
              <a href={`${APP_URL}/provider`} className="btn-green" style={{ fontSize: 13, padding: "10px 18px", minHeight: 40, width: "100%", justifyContent: "center" }}>
                提供者ポータルへ
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
