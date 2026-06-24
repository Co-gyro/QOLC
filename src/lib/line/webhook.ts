/**
 * LINE Messaging Webhook イベントの解析（純粋ロジック）。
 *
 * 友だち追加（follow）/ ブロック（unfollow）イベントから、
 * 「どの LINE userId をどの友だち状態に更新すべきか」を抽出する。
 */

/** Webhook で更新すべき友だち状態 */
export interface FollowStateChange {
  lineUserId: string;
  state: "followed" | "blocked";
}

/** LINE Webhook リクエストボディ（必要分のみ） */
interface WebhookBody {
  events?: Array<{
    type?: string;
    source?: { userId?: string };
  }>;
}

/**
 * Webhook ボディから follow/unfollow による友だち状態変更を抽出する。
 * userId を持たないイベントや対象外イベントは無視する。
 */
export function extractFollowChanges(body: unknown): FollowStateChange[] {
  const events = (body as WebhookBody)?.events;
  if (!Array.isArray(events)) return [];

  const changes: FollowStateChange[] = [];
  for (const ev of events) {
    const userId = ev?.source?.userId;
    if (!userId) continue;
    if (ev.type === "follow") {
      changes.push({ lineUserId: userId, state: "followed" });
    } else if (ev.type === "unfollow") {
      changes.push({ lineUserId: userId, state: "blocked" });
    }
  }
  return changes;
}
