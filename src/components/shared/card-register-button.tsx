"use client";

import Link from "next/link";

export interface CardRegisterButtonProps {
  residentAccountId: string;
  large?: boolean;
  label?: string;
}

/**
 * カード登録ページ（トークン式）への遷移ボタン。
 * 実際の登録処理は /user/card/register で行う（USEN SDK でカード入力）。
 */
export function CardRegisterButton({
  residentAccountId,
  large = false,
  label = "カードを登録する",
}: CardRegisterButtonProps) {
  return (
    <Link
      href={`/user/card/register?ra=${encodeURIComponent(residentAccountId)}`}
      className="qolc-btn rounded text-white font-bold inline-block text-center"
      style={{
        backgroundColor: "var(--qolc-primary)",
        minHeight: large ? 56 : 48,
        lineHeight: large ? "56px" : "48px",
        fontSize: large ? 18 : 16,
        padding: large ? "0 32px" : "0 24px",
      }}
    >
      {label}
    </Link>
  );
}
