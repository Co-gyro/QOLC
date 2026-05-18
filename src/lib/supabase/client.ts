/**
 * Supabase クライアント（ブラウザ用）
 *
 * Client Component / フックから使用する。
 * RLSが有効なので anon key でOK。
 */
import { createBrowserClient } from "@supabase/ssr";

/**
 * ブラウザ環境用 Supabase クライアントを生成する。
 * NEXT_PUBLIC_ で始まる環境変数のみ参照可能。
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase 環境変数が設定されていません (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }
  return createBrowserClient(url, anonKey);
}
