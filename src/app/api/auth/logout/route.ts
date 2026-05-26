/**
 * POST /api/auth/logout
 *
 * Supabase セッションを破棄して /login にリダイレクトする。
 * ヘッダーの「ログアウト」フォームから呼ばれる。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
