import type { JSX } from "react";
import { SUPPORT_EMAIL } from "@/lib/email/templates";

/**
 * 一般加盟店 申請サイトのフッター。
 *
 * 事業者の実在確認に必要な商号・連絡先のみを置く。QOLC のロゴ・ポータル・
 * サービス紹介への導線は置かない（介護以外のお客様向けの窓口のため）。
 */
export default function UdFooter(): JSX.Element {
  return (
    <footer className="ud-footer">
      <div className="ud-footer-name">株式会社ユニバーサル・デベロップメント</div>
      <div className="ud-footer-contact">
        お問い合わせ: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </div>
      <div className="ud-footer-links">
        <a href="https://uni-dev.jp" target="_blank" rel="noopener noreferrer">
          運営会社 ↗
        </a>
      </div>
      <p className="ud-footer-copy">
        &copy; 2026 Universal Development Co., Ltd.
      </p>
    </footer>
  );
}
