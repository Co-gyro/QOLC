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
import type { UserRole, PortalType } from "@/types";

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
  "/api/webhook",
  "/api/health",
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

  // レスポンスはここで初期化（Supabaseクライアントが cookies を書き込む対象）
  let response = NextResponse.next({ request: { headers: request.headers } });

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
