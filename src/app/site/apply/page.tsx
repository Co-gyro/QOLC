import type { JSX } from "react";
import type { Metadata } from "next";
import { isApplyType, type MerchantApplyType } from "@/lib/applications/apply-type";
import ApplyPageClient from "./_components/ApplyPageClient";

/**
 * ページタイトルを区分に合わせて上書きする。
 * サイト共通の title は「介護施設向け〜」のため、一般の店舗・事業所向けの
 * 入口ではブラウザタブにも介護の語が出ないようにする。
 */
export function generateMetadata({
  searchParams,
}: {
  searchParams?: { type?: string };
}): Metadata {
  if (searchParams?.type === "general") {
    return {
      title: "加盟店申請 | クレジットカード決済のお申し込み",
      description:
        "業種を問わずご利用いただけるクレジットカード決済の加盟店登録お申し込みフォームです。",
    };
  }
  return { title: "加盟店申請 | QOLC（コルク）" };
}

/**
 * 加盟店申請ページ（公開・ログイン不要）。
 *
 * 入口は2種類（介護施設向け＝QOLC / 一般の店舗・事業所向け）。
 * 区分未指定なら選択画面を出し、`?type=care` `?type=general` の直リンクでも
 * それぞれのフォームへ直接入れる（案内メール・営業資料からの導線用）。
 */
export default function ApplyPage({
  searchParams,
}: {
  searchParams?: { type?: string };
}): JSX.Element {
  const raw = searchParams?.type;
  const initialType: MerchantApplyType | null = isApplyType(raw) ? raw : null;
  return <ApplyPageClient initialType={initialType} />;
}
