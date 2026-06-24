/**
 * 招待トークン経由の LINE 新規家族登録（サーバー専用）。
 *
 * 既存のメール版受諾（/api/invite/accept）と同じ検証ロジックを LINE 向けに行う:
 *   - トークン検証（存在・未使用・未期限切れ）
 *   - 支払いオーナー二重登録チェック
 *   - LINE 連携 auth ユーザー作成 + profiles.line_user_id 設定
 *   - resident_account 作成（notification_method='line'）
 *   - 招待を used_at に更新
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineIdTokenClaims } from "./types";
import { createLineUser } from "./account";

/** 招待受諾の失敗理由（HTTP ステータスへのマッピングに使う） */
export type LineInviteErrorCode = "NOT_FOUND" | "USED" | "EXPIRED" | "OWNER_EXISTS" | "LINK_FAILED";

/** 招待受諾エラー */
export class LineInviteError extends Error {
  readonly code: LineInviteErrorCode;
  constructor(code: LineInviteErrorCode, message: string) {
    super(message);
    this.name = "LineInviteError";
    this.code = code;
  }
}

/** 招待受諾の成功結果 */
export interface LineInviteAcceptResult {
  userId: string;
  email: string;
  residentId: string;
  facilityId: string | null;
  displayName: string;
}

/**
 * 招待トークンと LINE 本人情報から家族アカウントを作成する。
 * @throws {LineInviteError} 検証・作成に失敗した場合
 */
export async function acceptInviteWithLine(
  admin: SupabaseClient,
  inviteToken: string,
  claims: LineIdTokenClaims
): Promise<LineInviteAcceptResult> {
  const { data: inv } = await admin
    .from("invitations")
    .select("id, resident_id, account_type, is_payment_owner, expires_at, used_at")
    .eq("token", inviteToken)
    .maybeSingle();
  if (!inv) throw new LineInviteError("NOT_FOUND", "招待が見つかりません");
  if (inv.used_at) throw new LineInviteError("USED", "この招待は既に使用されています");
  if (new Date(inv.expires_at as string).getTime() < Date.now()) {
    throw new LineInviteError("EXPIRED", "この招待は有効期限が切れています");
  }

  if (inv.is_payment_owner) {
    const { data: owner } = await admin
      .from("resident_accounts")
      .select("id")
      .eq("resident_id", inv.resident_id)
      .eq("is_payment_owner", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (owner) {
      throw new LineInviteError("OWNER_EXISTS", "この入居者には既に支払い担当者が登録されています");
    }
  }

  const displayName = claims.name || "LINEユーザー";
  const { userId, email } = await createLineUser(admin, claims.sub, displayName);

  const { error: raErr } = await admin.from("resident_accounts").insert({
    resident_id: inv.resident_id,
    user_id: userId,
    type: inv.account_type,
    is_payment_owner: inv.is_payment_owner,
    notification_method: "line",
    line_follow_state: "unknown",
  });
  if (raErr) {
    await admin.auth.admin.deleteUser(userId);
    throw new LineInviteError("LINK_FAILED", `アカウント紐付けに失敗しました: ${raErr.message}`);
  }

  await admin.from("invitations").update({ used_at: new Date().toISOString() }).eq("id", inv.id);

  const { data: res } = await admin
    .from("residents")
    .select("facility_id")
    .eq("id", inv.resident_id)
    .single();

  return {
    userId,
    email,
    residentId: inv.resident_id as string,
    facilityId: (res?.facility_id as string | null) ?? null,
    displayName,
  };
}
