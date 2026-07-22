/**
 * ポータル共通ヘッダー
 */
"use client";

import Link from "next/link";

export interface HeaderProps {
  userName?: string;
  userRole?: string;
}

export function Header({ userName, userRole }: HeaderProps) {
  return (
    <header
      className="h-16 border-b flex items-center justify-between px-4 md:px-6"
      style={{ borderColor: "var(--qolc-border)" }}
    >
      <Link href="/" className="font-bold text-xl" style={{ color: "var(--qolc-primary)" }}>
        QOLC
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {userName && (
          // スマホ幅では名前を隠してログアウトのみ表示（窮屈さ回避）
          <span className="hidden sm:inline" style={{ color: "var(--qolc-muted)" }}>
            {userName}
            {userRole && <span className="ml-2">({userRole})</span>}
          </span>
        )}
        <Link
          href="/set-password"
          className="hidden sm:inline hover:underline"
          style={{ color: "var(--qolc-muted)" }}
        >
          パスワード変更
        </Link>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="qolc-btn px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
            style={{ borderColor: "var(--qolc-border)" }}
          >
            ログアウト
          </button>
        </form>
      </div>
    </header>
  );
}
