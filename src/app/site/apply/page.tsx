import type { JSX } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ApplyPageClient from "./_components/ApplyPageClient";

export const metadata: Metadata = {
  title: "加盟店申請 | QOLC（コルク）",
};

/**
 * 加盟店申請ページ（介護施設向け・公開・ログイン不要）。
 *
 * 一般の店舗・事業所向けは /merchant に独立した窓口として分離してあり、
 * 本ページからは相互リンクを持たない（それぞれ独立した入口として運用する）。
 * 旧 `?type=general` のリンクだけは /merchant へ引き継ぐ。
 */
export default function ApplyPage({
  searchParams,
}: {
  searchParams?: { type?: string };
}): JSX.Element {
  if (searchParams?.type === "general") redirect("/merchant");
  return <ApplyPageClient />;
}
