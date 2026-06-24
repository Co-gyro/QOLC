/**
 * GET /api/auth/line/login
 *
 * LINE Login（OAuth2 / OIDC）を開始する。
 * - 署名済み state を生成し、HttpOnly Cookie に保存（CSRF 二重送信）
 * - LINE 認可画面へリダイレクト
 *
 * クエリ:
 *   next?   ログイン後の遷移先（内部パスのみ。state 検証時にサニタイズ）
 *   invite? 招待トークン（招待経由の新規家族登録の場合）
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  getLineLoginConfig,
  isLineLoginConfigured,
  LINE_STATE_COOKIE,
  LINE_STATE_TTL_SEC,
} from "@/lib/line/config";
import { buildAuthorizeUrl, generateNonce } from "@/lib/line/oauth";
import { signState } from "@/lib/line/state";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isLineLoginConfigured()) {
    return NextResponse.redirect(new URL("/login?error=line_unavailable", req.url));
  }
  const config = getLineLoginConfig();

  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? undefined;
  const inviteToken = url.searchParams.get("invite") ?? undefined;

  const nonce = generateNonce();
  const state = signState(
    { nonce, next, inviteToken, iat: Math.floor(Date.now() / 1000) },
    config.channelSecret
  );

  const res = NextResponse.redirect(buildAuthorizeUrl(config, state, nonce));
  // sameSite=lax: LINE からのトップレベルGETリダイレクトで Cookie を送出させる
  res.cookies.set(LINE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LINE_STATE_TTL_SEC,
  });
  return res;
}
