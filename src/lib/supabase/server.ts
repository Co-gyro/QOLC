/**
 * Supabase クライアント（Server Component / Server Action 用）
 *
 * Next.js の cookies() と連携してセッションを維持する。
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Component 用 Supabase クライアントを生成する。
 * cookies() からセッションクッキーを読み書きする。
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase 環境変数が設定されていません");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Component から set されることはあるが、Next.js の制約で例外になることがある
          // middleware で更新されていれば問題ない
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // ignore
        }
      },
    },
  });
}
