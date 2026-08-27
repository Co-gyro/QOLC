/**
 * 紹介サイトホスト（qolc.jp / www.qolc.jp）で「アプリ側のパス」が要求されたときの
 * 転送先を決める純関数。
 *
 * 背景: マーケホストのアクセスは middleware が `/site/*` へ rewrite するため、
 * `/login` や `/admin` を qolc.jp 側で開くと `/site/login` を探して 404 になる。
 * ブックマークやメール・口頭案内で `qolc.jp/admin` を開いた利用者が
 * 「ログイン画面すら出ない」状態に陥るため、アプリ本体（app.qolc.jp）へ
 * 恒久リダイレクトして救済する。
 */

/** アプリ本体にしか存在しないパスのプレフィックス（マーケホストでは転送する） */
export const APP_ONLY_PREFIXES = [
  "/login",
  "/register",
  "/admin",
  "/facility",
  "/provider",
  "/user",
  "/liff",
  "/invite",
  "/udpay",
] as const;

/** アプリ本体のベースURL（未設定・相対値の場合は本番既定にフォールバック） */
const DEFAULT_APP_ORIGIN = "https://app.qolc.jp";

/**
 * 環境変数 NEXT_PUBLIC_APP_URL からアプリのオリジンを取り出す。
 * ローカル開発の `http://localhost:3000` がそのまま本番に混入すると
 * 公開サイトから localhost へ飛ばしてしまうため、http は採用しない。
 * @param appUrl NEXT_PUBLIC_APP_URL の値
 * @returns https のオリジン文字列（末尾スラッシュなし）
 */
export function resolveAppOrigin(appUrl: string | undefined): string {
  if (!appUrl) return DEFAULT_APP_ORIGIN;
  try {
    const u = new URL(appUrl);
    if (u.protocol !== "https:") return DEFAULT_APP_ORIGIN;
    return u.origin;
  } catch {
    return DEFAULT_APP_ORIGIN;
  }
}

/**
 * マーケホストで受けたパスがアプリ側のものか判定する。
 * @param pathname リクエストパス
 */
export function isAppOnlyPath(pathname: string): boolean {
  return APP_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/**
 * マーケホストからアプリ本体へ転送すべきURLを返す（不要なら null）。
 * クエリ文字列（?next=... など）は保持する。
 * @param pathname リクエストパス
 * @param search クエリ文字列（先頭 `?` 込み。無ければ空文字）
 * @param appUrl NEXT_PUBLIC_APP_URL の値
 */
export function appRedirectUrl(
  pathname: string,
  search: string,
  appUrl: string | undefined
): string | null {
  if (!isAppOnlyPath(pathname)) return null;
  return `${resolveAppOrigin(appUrl)}${pathname}${search}`;
}
