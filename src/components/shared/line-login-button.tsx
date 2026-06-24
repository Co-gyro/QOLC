/**
 * LINE ログイン/登録ボタン（LINE ブランドガイド準拠の緑ボタン）。
 *
 * クリックでサーバーの OAuth 開始エンドポイント（/api/auth/line/login）へ遷移する。
 * 高齢者対応のためフォントは 16px、タッチ高さ 48px を確保する。
 */

/** LINE ブランドカラー */
const LINE_GREEN = "#06C755";

interface LineLoginButtonProps {
  /** ボタン文言（例: 「LINEでログイン」「LINEで登録」） */
  label: string;
  /** ログイン後の遷移先（内部パス） */
  next?: string;
  /** 招待トークン（招待経由の新規登録時のみ） */
  inviteToken?: string;
}

/**
 * LINE ログイン開始ボタン。
 */
export function LineLoginButton({ label, next, inviteToken }: LineLoginButtonProps) {
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (inviteToken) params.set("invite", inviteToken);
  const href = `/api/auth/line/login${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <a
      href={href}
      className="flex items-center justify-center gap-2 w-full rounded font-medium text-white"
      style={{ backgroundColor: LINE_GREEN, minHeight: 48, fontSize: 16 }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.48 2 2 5.69 2 10.23c0 4.07 3.58 7.48 8.42 8.12.33.07.78.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.01.89.55 1.09-.46 5.86-3.45 8-5.91 1.48-1.62 2.01-3.27 2.01-5.04C22 5.69 17.52 2 12 2zM8.2 12.6H6.13a.43.43 0 01-.43-.43V8.04c0-.24.2-.43.43-.43.24 0 .43.19.43.43v3.7H8.2c.24 0 .43.2.43.43 0 .24-.19.43-.43.43zm1.67-.43c0 .24-.2.43-.43.43a.43.43 0 01-.43-.43V8.04c0-.24.2-.43.43-.43.24 0 .43.19.43.43v4.13zm4.97 0c0 .19-.12.35-.3.41a.44.44 0 01-.13.02.43.43 0 01-.35-.17l-2.12-2.88v2.62c0 .24-.19.43-.43.43a.43.43 0 01-.43-.43V8.04c0-.18.12-.35.3-.41a.43.43 0 01.48.15l2.12 2.88V8.04c0-.24.2-.43.43-.43.24 0 .43.19.43.43v4.13zm3.34-2.5c.24 0 .43.2.43.43 0 .24-.19.44-.43.44h-1.07v.69h1.07c.24 0 .43.19.43.43 0 .24-.19.43-.43.43h-1.5a.43.43 0 01-.43-.43V8.04c0-.24.19-.43.43-.43h1.5c.24 0 .43.19.43.43 0 .24-.19.44-.43.44h-1.07v.69h1.07z" />
      </svg>
      {label}
    </a>
  );
}
