import type { JSX } from "react";

/**
 * 一般加盟店 申請サイトのヘッダー。
 *
 * QOLC（介護施設向けサービス）への動線は一切置かない。ロゴ・商号と、
 * 何の窓口かを示す一文のみ。ナビゲーションを持たせないのは、申請フォーム
 * 1本のサイトであり回遊させる先が無いため。
 */
export default function UdHeader(): JSX.Element {
  return (
    <header className="ud-header">
      <a
        className="ud-header-logo"
        href="https://uni-dev.jp"
        target="_blank"
        rel="noopener noreferrer"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site/UDlogo.png" alt="株式会社ユニバーサル・デベロップメント" />
      </a>
      <div className="ud-header-tag">クレジットカード決済 加盟店申請窓口</div>
    </header>
  );
}
