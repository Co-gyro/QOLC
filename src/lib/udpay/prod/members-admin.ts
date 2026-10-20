import { buildSetPasswordUrl } from "@/lib/auth/invite-callback";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * UD Payment 利用者（加盟店の担当者・承認者）のアカウント管理（UD 管理画面から）。
 * 発行: auth ユーザー作成（role=udpay_merchant）→ profiles → udpay_members → 招待リンク（初回パスワード設定）。
 */

/** 利用者1人 */
export interface MemberRow {
  userId: string;
  displayName: string;
  email: string | null;
  isApprover: boolean;
  /** 招待リンクからパスワードを設定済みか（最終ログインがあるか） */
  activated: boolean;
}

/** 発行の入力 */
export const memberInviteSchema = z.object({
  merchantId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(254),
  isApprover: z.boolean(),
});
export type MemberInvite = z.infer<typeof memberInviteSchema>;

/** 加盟店の利用者一覧 */
export async function listMembers(client: SupabaseClient, merchantId: string): Promise<MemberRow[]> {
  const { data, error } = await client
    .from("udpay_members")
    .select("user_id, display_name, is_approver")
    .eq("merchant_id", merchantId)
    .is("deleted_at", null)
    .order("created_at");
  if (error) throw new Error(`利用者の取得に失敗: ${error.message}`);
  const rows: MemberRow[] = [];
  for (const m of (data ?? []) as { user_id: string; display_name: string; is_approver: boolean }[]) {
    const { data: u } = await client.auth.admin.getUserById(m.user_id);
    rows.push({
      userId: m.user_id,
      displayName: m.display_name,
      email: u?.user?.email ?? null,
      isApprover: m.is_approver,
      activated: Boolean(u?.user?.last_sign_in_at),
    });
  }
  return rows;
}

/** 招待メール（UD Payment 名義） */
export function buildMemberInviteMail(input: { displayName: string; merchantName: string; isApprover: boolean; inviteUrl: string }) {
  return {
    subject: "【UD Payment】ログインアカウント発行のご案内",
    text: `${input.merchantName}
${input.displayName} 様

UD Payment（請求・カード自動課金）のログインアカウントを発行しました。
下記のリンクを開き、パスワードを設定してください。設定が終わると、そのまま画面をお使いいただけます。

▼パスワード設定（初回のみ）
${input.inviteUrl}

・権限: ${input.isApprover ? "承認者（請求の作成・課金予約に加えて、一括実行＝決済の確定ができます）" : "担当者（請求の作成・課金予約ができます。一括実行は承認者が行います）"}
・2回目以降のログイン: https://app.qolc.jp/login （メールアドレスと設定したパスワード）
・このリンクの有効期限は24時間です。期限が切れた場合はご連絡ください。再発行いたします。

ご不明な点は support@uni-dev.jp までお問い合わせください。

株式会社ユニバーサル・デベロップメント
UD Payment サポート`,
  };
}

/** 発行結果 */
export type InviteResult =
  | { ok: true; userId: string; inviteUrl: string }
  | { ok: false; error: string; status: number };

/**
 * 利用者を発行する。途中で失敗したら作成した auth ユーザーを削除して元に戻す。
 * 招待リンクは呼び出し側でメール送付し、送れない場合でも画面からコピーできるよう返す。
 */
export async function inviteMember(client: SupabaseClient, input: MemberInvite, appUrl: string): Promise<InviteResult> {
  const { data: created, error: createErr } = await client.auth.admin.createUser({
    email: input.email,
    email_confirm: false,
    app_metadata: { role: "udpay_merchant" },
    user_metadata: { display_name: input.displayName },
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? "";
    if (createErr?.status === 422 || /already|registered|exists/i.test(msg)) {
      return { ok: false, error: "このメールアドレスは既に登録されています", status: 409 };
    }
    return { ok: false, error: "アカウントの作成に失敗しました", status: 500 };
  }
  const userId = created.user.id;
  // 発行の途中失敗の巻き戻し（作ったばかりの行だけを消す。運用中の利用者は updateMember で論理削除する）
  const rollback = async (error: string): Promise<InviteResult> => {
    await client.from("udpay_members").delete().eq("user_id", userId);
    await client.auth.admin.deleteUser(userId);
    return { ok: false, error, status: 500 };
  };
  const prof = await client
    .from("profiles")
    .upsert({ id: userId, role: "udpay_merchant", merchant_id: input.merchantId, display_name: input.displayName }, { onConflict: "id" });
  if (prof.error) return rollback("プロフィールの設定に失敗しました");
  const mem = await client.from("udpay_members").insert({
    user_id: userId,
    merchant_id: input.merchantId,
    display_name: input.displayName,
    is_approver: input.isApprover,
  });
  if (mem.error) return rollback("利用者の登録に失敗しました");
  const { data: link, error: linkErr } = await client.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: { redirectTo: `${appUrl.replace(/\/$/, "")}/set-password` },
  });
  const hashed = link?.properties?.hashed_token;
  const inviteUrl = hashed ? buildSetPasswordUrl(appUrl, hashed, "invite") : null;
  if (linkErr || !inviteUrl) return rollback("招待リンクの生成に失敗しました");
  return { ok: true, userId, inviteUrl };
}

/** 承認権限の切り替え・利用停止（論理削除。auth ユーザーは無効化） */
export async function updateMember(
  client: SupabaseClient,
  merchantId: string,
  userId: string,
  change: { isApprover?: boolean; deactivate?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  if (change.deactivate) {
    const { error } = await client
      .from("udpay_members")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("merchant_id", merchantId);
    if (error) return { ok: false, error: error.message };
    // ログインもできないようにする（約100年の利用停止）
    await client.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    return { ok: true };
  }
  if (typeof change.isApprover === "boolean") {
    const { error } = await client
      .from("udpay_members")
      .update({ is_approver: change.isApprover })
      .eq("user_id", userId)
      .eq("merchant_id", merchantId)
      .is("deleted_at", null);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}
