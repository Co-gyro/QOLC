/**
 * 汎用 操作ログ（activity_logs）の記録ヘルパー。
 * 監査記録の失敗で本処理を止めないよう、内部で握りつぶす（throwしない）。
 * 記録は service_role（admin client）で行い RLS をバイパスする。
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export interface ActivityLogInput {
  actorId?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  /** 施設スコープ（施設管理者に見せる範囲。運営のみの操作は null）。 */
  facilityId?: string | null;
  /** 操作コード（例: resident_create, invite_create, upload, merchant_create）。 */
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  /** 表示用ラベル（入居者名・加盟店名など）。 */
  targetLabel?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** 操作ログを1件記録する。失敗しても例外は投げない。 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    let actorName = input.actorName ?? null;
    let actorRole = input.actorRole ?? null;
    // 表示名・役割が未指定なら profiles から補完（任意）。
    if (input.actorId && (!actorName || !actorRole)) {
      const { data } = await admin
        .from("profiles")
        .select("display_name, role")
        .eq("id", input.actorId)
        .single();
      actorName = actorName ?? (data?.display_name as string | null) ?? null;
      actorRole = actorRole ?? (data?.role as string | null) ?? null;
    }
    await admin.from("activity_logs").insert({
      actor_id: input.actorId ?? null,
      actor_role: actorRole,
      actor_name: actorName,
      facility_id: input.facilityId ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      target_label: input.targetLabel ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (e) {
    // 監査記録の失敗は本処理に影響させない（テーブル未作成時も含む）。
    console.error("[activity-log] 記録に失敗しました:", e);
  }
}
