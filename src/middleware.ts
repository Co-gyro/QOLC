/**
 * Next.js Middleware
 *
 * - Supabase セッションをリフレッシュ
 * - ロールに応じたポータルへルーティング制御
 * - 未認証ユーザーを保護されたパスから /login にリダイレクト
 * - /api/* は API Route 側で個別に認証チェック（ここではセッション維持のみ）
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware-client";
import { appRedirectUrl } from "@/lib/site/app-redirect";
import type { UserRole, PortalType } from "@/types";

/**
 * 紹介サイト（マーケ）として扱うホスト名。該当ホストのアクセスは実装セグメント
 * `/site/*` へ rewrite する。app.qolc.jp（アプリ本体）や未知ホストはこの分岐に
 * 入らず、従来どおりの認証フローで処理される（挙動不変）。
 * 既定は本番ドメイン。Vercel の env `MARKETING_HOSTS`（カンマ区切り）で上書き可能。
 */
const MARKETING_HOSTS = (process.env.MARKETING_HOSTS ?? "qolc.jp,www.qolc.jp")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** ロールごとに許可するパスのプレフィックス */
const ROLE_PORTAL_MAP: Record<UserRole, PortalType> = {
  admin: "admin",
  facility_staff: "facility",
  provider: "provider",
  family: "user",
};

/** 認証不要の公開パス（プレフィックス一致） */
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/register",
  "/liff",
  "/api/webhook",
  "/api/health",
  "/udpay",
  "/api/udpay",
  "/_next",
  "/favicon",
  "/QOLC_design_system.html",
];

/** ポータルプレフィックス（ロール権限が必要） */
const PORTAL_PREFIXES: PortalType[] = ["admin", "facility", "provider", "user"];

/**
 * パスが公開パスかどうか判定する。
 */
function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * パスからポータル種別を取り出す（マッチしなければ null）。
 */
function getPortalFromPath(pathname: string): PortalType | null {
  for (const portal of PORTAL_PREFIXES) {
    if (pathname === `/${portal}` || pathname.startsWith(`/${portal}/`)) {
      return portal;
    }
  }
  return null;
}

/**
 * Next.js Middleware エントリポイント。
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- ホスト名によるサイト分岐（紹介サイト qolc.jp）--------------------------
  // マーケ用ホストは実装セグメント /site/* へ rewrite し、アプリの認証処理には
  // 一切入らせない（公開サイトのため）。app.qolc.jp・未知ホストはこの分岐を通らず
  // 従来どおり処理されるため、既存アプリの挙動は変わらない。
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (MARKETING_HOSTS.includes(host)) {
    // API（フォーム送信等）と Next 静的アセットは rewrite せず素通し
    if (
      pathname.startsWith("/api") ||
      pathname.startsWith("/_next") ||
      pathname === "/site" ||
      pathname.startsWith("/site/")
    ) {
      return NextResponse.next();
    }
    // アプリ本体にしか無いパス（/login・/admin など）は 404 にせず app.qolc.jp へ転送。
    // 「qolc.jp/admin を開いたらログイン画面すら出ない」導線の断絶を防ぐ。
    const appUrl = appRedirectUrl(
      pathname,
      request.nextUrl.search,
      process.env.NEXT_PUBLIC_APP_URL
    );
    if (appUrl) return NextResponse.redirect(appUrl, 308);

    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/site" : `/site${pathname}`;
    return NextResponse.rewrite(url);
  }
  // --------------------------------------------------------------------------

  // --- UD Payment 常設デモの合言葉キーゲート ---------------------------------
  // UDPAY_DEMO_KEY 設定時のみ有効（ローカル・E2Eでは未設定でゲートなし）。
  // /udpay/card/*（顧客向けカード登録・独自トークンで保護）と /api/udpay
  // （カード登録POSTに必要・デモデータのみ）はキー不要。
  const udpayKey = process.env.UDPAY_DEMO_KEY;
  if (
    udpayKey &&
    pathname.startsWith("/udpay") &&
    !pathname.startsWith("/udpay/card/")
  ) {
    const cookieKey = request.cookies.get("udpay_demo_key")?.value;
    if (cookieKey !== udpayKey) {
      const queryKey = request.nextUrl.searchParams.get("key");
      if (queryKey === udpayKey) {
        const url = request.nextUrl.clone();
        url.searchParams.delete("key");
        const redirect = NextResponse.redirect(url);
        redirect.cookies.set("udpay_demo_key", udpayKey, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/udpay",
          maxAge: 60 * 60 * 24 * 90,
        });
        return redirect;
      }
      return new NextResponse(
        "アクセスキーが必要です。案内されたキー付きURLからアクセスしてください。",
        { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
  }
  // --------------------------------------------------------------------------

  // レスポンスはここで初期化（Supabaseクライアントが cookies を書き込む対象）
  const response = NextResponse.next({ request: { headers: request.headers } });

  // 環境変数未設定でも middleware は通す（開発の便宜上）
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createSupabaseMiddlewareClient(request, response);

  // セッションを取得（getUser() でサーバーに検証させる）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /api/* はセッション維持のみ
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // 公開パスは素通し
  if (isPublicPath(pathname)) {
    return response;
  }

  const portal = getPortalFromPath(pathname);

  // ポータルパスでない（= 一般ページ） → そのまま通す
  if (!portal) {
    return response;
  }

  // 未認証で保護されたポータルへアクセス → /login にリダイレクト
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ロール取得: app_metadata > profiles テーブル
  const appMetaRole = (user.app_metadata?.role as UserRole | undefined) ?? null;
  let role: UserRole | null = appMetaRole;

  if (!role) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = (profile?.role as UserRole | undefined) ?? null;
  }

  if (!role) {
    // プロフィール未作成 → エラーページ（簡易的に /login へ）
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "no_profile");
    return NextResponse.redirect(loginUrl);
  }

  const allowedPortal = ROLE_PORTAL_MAP[role];

  // ロールに対応するポータル以外へのアクセスは 403
  if (portal !== allowedPortal) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return response;
}

export const config = {
  // 静的ファイル等を除外
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
