/**
 * QOLC Wallet API の認証。
 * iPhone アプリは Authorization: Bearer <Supabase アクセストークン>、施設ポータルは Cookie で来る。
 * TODO(W1): 職員の選択と PIN（スコープ付きトークン）。デモでは施設アカウントで直接操作する。
 */
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiError } from "@/types/api";

/** 認証済みの施設職員 */
export interface WalletStaff {
  admin: SupabaseClient;
  userId: string;
  facilityId: string;
}

/** 失敗時のレスポンス */
export type WalletAuthResult = WalletStaff | { response: NextResponse };

/** Authorization ヘッダーの Bearer トークンを取り出す */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** エラーのレスポンスを作る */
export function walletError(message: string, code: string, status: number): { response: NextResponse } {
  return { response: NextResponse.json(apiError(message, code), { status }) };
}

/** facility_staff であることと所属施設を確かめる */
export async function authorizeWalletStaff(req: NextRequest): Promise<WalletAuthResult> {
  const admin = getSupabaseAdminClient();
  const token = bearerToken(req);
  const { data } = token
    ? await admin.auth.getUser(token)
    : await createSupabaseServerClient().auth.getUser();
  const user = data.user;
  if (!user) return walletError("ログインしてください", "UNAUTHORIZED", 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("role, facility_id")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  const role = (user.app_metadata?.role as string | undefined) ?? profile?.role;
  if (role !== "facility_staff" || !profile?.facility_id) {
    return walletError("施設のアカウントでログインしてください", "FORBIDDEN", 403);
  }
  return { admin, userId: user.id, facilityId: profile.facility_id as string };
}

/** 運営センター（admin）であることを確かめる */
export async function authorizeWalletAdmin(
  req: NextRequest,
): Promise<{ admin: SupabaseClient; userId: string } | { response: NextResponse }> {
  const admin = getSupabaseAdminClient();
  const token = bearerToken(req);
  const { data } = token
    ? await admin.auth.getUser(token)
    : await createSupabaseServerClient().auth.getUser();
  const user = data.user;
  if (!user) return walletError("ログインしてください", "UNAUTHORIZED", 401);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (user.app_metadata?.role as string | undefined) ?? profile?.role;
  if (role !== "admin") return walletError("権限がありません", "FORBIDDEN", 403);
  return { admin, userId: user.id };
}
