import "./ud.css";
import type { Metadata } from "next";

/**
 * 一般加盟店 申請サイト（qolc.jp/merchant）専用レイアウト。
 *
 * 上位 site/layout のフォント（Noto Sans JP）は継承しつつ、
 * メタデータは UD 名義で上書きする。上位の title は
 * 「QOLC（コルク）| 介護施設向け〜」のため、ブラウザのタブや検索結果に
 * 介護／QOLC の語が出ないようここで必ず差し替える。
 */
export const metadata: Metadata = {
  title: "加盟店申請 | 株式会社ユニバーサル・デベロップメント",
  description:
    "クレジットカード決済の加盟店登録お申し込みフォームです。業種は問いません。お申し込み後、担当者がヒアリングのうえ当社にて加盟店審査を行います。",
};

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
