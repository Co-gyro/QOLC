/**
 * Supabase Admin クライアント（API Route / バッチ処理用）
 *
 * Service Role Key を使用するため RLS をバイパスする。
 * **絶対にクライアントサイドへ渡してはならない**。サーバー側コードからのみ呼び出すこと。
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Admin（service_role）クライアントを取得する。
 * サーバープロセス内でシングルトンとしてキャッシュする。
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase Admin 環境変数が設定されていません (SUPABASE_SERVICE_ROLE_KEY)"
    );
  }

  cached = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
