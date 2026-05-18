/**
 * Supabase スキーマの型定義
 *
 * 本来は Supabase CLI で自動生成する:
 *   npx supabase gen types typescript --project-id [PROJECT_ID] > src/lib/supabase/types.ts
 *
 * このファイルはプロジェクト接続前のプレースホルダ。
 * Phase 1 完了後、接続情報を .env.local に設定して上記コマンドで上書きする。
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** スキーマ自動生成までの暫定型 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
