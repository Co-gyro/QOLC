import type { JSX } from "react";
import MerchantApplyView from "./_components/MerchantApplyView";

/**
 * 一般加盟店の申請ページ（qolc.jp/merchant・公開・ログイン不要）。
 *
 * 介護施設向け（QOLC）の /apply とは完全に独立した窓口として運用する。
 * 本ページからは QOLC への導線を一切持たない（ヘッダー・フッター・
 * ページタイトルすべて UD 名義）。
 */
export default function MerchantApplyPage(): JSX.Element {
  return <MerchantApplyView />;
}
