/**
 * 通知ディスパッチャ（サーバー専用）。
 *
 * 1 件の通知を `notifications` テーブルに記録し、対象アカウントが LINE 通知対象なら
 * Messaging API で push する（ベストエフォート。push 失敗で本処理は止めない）。
 *
 * 設計方針:
 *   - 必ず DB へ記録する（push 可否に関わらず履歴は残す）。
 *   - LINE push は「method=line かつ 未ブロック かつ line_user_id あり かつ Messaging 設定済み」のみ。
 *   - push 成功時のみ sent_at を埋める（未送信＝ポータルでの確認用お知らせとして残る）。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getLineMessagingConfig,
  isLineMessagingConfigured,
} from "@/lib/line/config";
import { buildTextMessage, pushMessage } from "@/lib/line/messaging";

/** 通知1件の入力 */
export interface NotifyInput {
  /** 宛先の resident_account */
  residentAccountId: string;
  /** 通知種別（例: 'payment_completed', 'card_expiring', 'statement_ready'） */
  type: string;
  /** 見出し */
  title: string;
  /** 本文（任意） */
  body?: string;
}

/** LINE push の対象判定に使うアカウント状態 */
export interface LinePushTarget {
  notificationMethod: string | null;
  lineFollowState: string | null;
  lineUserId: string | null;
}

/**
 * LINE push を行うべきアカウントかを判定する（純粋関数）。
 * - 通知手段が line
 * - 公式アカウントをブロックしていない
 * - line_user_id を保有している
 */
export function isLinePushEligible(target: LinePushTarget): boolean {
  return (
    target.notificationMethod === "line" &&
    target.lineFollowState !== "blocked" &&
    Boolean(target.lineUserId)
  );
}

/**
 * 1 件の resident_account に通知する（記録 + 任意で LINE push）。
 * push 失敗は握りつぶす（記録は残る）。
 */
export async function notifyResidentAccount(
  admin: SupabaseClient,
  input: NotifyInput
): Promise<void> {
  // 1) 履歴を記録（push 可否に関わらず）
  const { data: inserted, error: insErr } = await admin
    .from("notifications")
    .insert({
      resident_account_id: input.residentAccountId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    console.error("[notify] 通知記録に失敗しました:", insErr?.message);
    return;
  }

  // 2) LINE push 対象か判定
  const { data: account } = await admin
    .from("resident_accounts")
    .select("notification_method, line_follow_state, user_id, profiles(line_user_id)")
    .eq("id", input.residentAccountId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!account) return;

  const profile = account.profiles as unknown as { line_user_id: string | null } | null;
  const target: LinePushTarget = {
    notificationMethod: account.notification_method as string | null,
    lineFollowState: account.line_follow_state as string | null,
    lineUserId: profile?.line_user_id ?? null,
  };

  if (!isLinePushEligible(target) || !isLineMessagingConfigured()) return;

  // 3) push（ベストエフォート）
  try {
    const config = getLineMessagingConfig();
    await pushMessage(config, target.lineUserId as string, [
      buildTextMessage(input.title, input.body),
    ]);
    await admin
      .from("notifications")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", inserted.id);
  } catch (e) {
    console.error("[notify] LINE push に失敗しました:", (e as Error).message);
  }
}

/**
 * 入居者に紐づく全アクティブアカウントへ通知する（家族・本人ともに）。
 */
export async function notifyResident(
  admin: SupabaseClient,
  residentId: string,
  input: Omit<NotifyInput, "residentAccountId">
): Promise<void> {
  const { data: accounts } = await admin
    .from("resident_accounts")
    .select("id")
    .eq("resident_id", residentId)
    .is("deleted_at", null);
  if (!accounts || accounts.length === 0) return;

  await Promise.all(
    accounts.map((a) =>
      notifyResidentAccount(admin, { ...input, residentAccountId: a.id as string })
    )
  );
}
