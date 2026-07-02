import "./jcb.css";
import type { Metadata } from "next";
import { Noto_Serif_JP } from "next/font/google";

/**
 * JCB総合窓口LP（qolc.jp/jcb）専用レイアウト。
 * 見出し用の Noto Serif JP を next/font で読み込み、CSS変数として供給する。
 * 本文フォント（Noto Sans JP）は上位 site/layout から継承する。
 */
const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["300", "500", "700"],
  variable: "--font-noto-serif-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "シニアの住まいの相談窓口 QOLC | JCB × Universal Development",
  description:
    "JCBカードホルダー様向け シニアの住まいの相談窓口。クレジットカード決済対応のシニアレジデンスを、専任コンシェルジュがご紹介。ご相談は無料・秘密厳守。",
};

export default function JcbLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={notoSerifJP.variable}>{children}</div>;
}
