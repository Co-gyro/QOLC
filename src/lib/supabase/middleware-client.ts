/**
 * Middleware 用 Supabase クライアント
 *
 * Next.js Middleware ランタイム（Edge）で NextRequest / NextResponse の cookies を扱う。
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Middleware で使用する Supabase クライアントを生成する。
 * @param request - Next.js のリクエスト
 * @param response - Next.js のレスポンス（Cookieが書き込まれる）
 */
export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase 環境変数が設定されていません");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });
}
