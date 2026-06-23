/**
 * GET /api/logs
 *
 * 決済の監査ログ(payment_audit_logs)と運用操作ログ(activity_logs)を統合し、
 * 役割に応じて自然文表示用に整形して返す。
 *   - admin         : 全施設（?facilityId で絞り込み可）
 *   - facility_staff : 自施設のログのみ
 *   - provider       : 自加盟店の決済 ＋ 自分の操作
 * 改ざん防止のため読み取り専用。生データ(JSON)は admin のみ含める。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

type Kind = "success" | "warn" | "info";

/** 決済操作の表示属性。低レベルAPI呼出は除外。 */
const PAY_META: Record<string, { label: string; verb: string; kind: Kind }> = {
  sales_add: { label: "決済実行", verb: "実行", kind: "success" },
  sales_cancel: { label: "決済取消", verb: "取消", kind: "warn" },
  sales_return: { label: "返金", verb: "返金", kind: "warn" },
  auth_void: { label: "与信取消", verb: "取消", kind: "warn" },
  ec_checkout: { label: "カード登録", verb: "登録", kind: "info" },
};
const PAY_ACTIONS = Object.keys(PAY_META);

/** 運用操作の表示属性。 */
const ACT_META: Record<string, { label: string; kind: Kind }> = {
  resident_create: { label: "入居者追加", kind: "info" },
  resident_update: { label: "入居者編集", kind: "info" },
  invite_create: { label: "アカウント招待", kind: "info" },
  invite_accept: { label: "アカウント参加", kind: "info" },
  upload: { label: "明細アップロード", kind: "success" },
  merchant_create: { label: "加盟店登録", kind: "info" },
  payment_owner_set: { label: "決済オーナー設定", kind: "info" },
};

interface Entry {
  id: string;
  action: string;
  actionLabel: string;
  kind: Kind;
  summary: string;
  createdAt: string;
  detail: unknown | null;
}

/** 運用ログ1件 → 自然文。 */
function activitySummary(action: string, actor: string, label: string | null, meta: Record<string, unknown> | null): string {
  const t = label ?? "";
  switch (action) {
    case "resident_create": return `${actor} が入居者「${t}」を追加しました`;
    case "resident_update": return `${actor} が入居者「${t}」を編集しました`;
    case "invite_create": return `${actor} が ${t}（ご家族）を招待しました`;
    case "invite_accept": return `${t || actor} がアカウントに参加しました`;
    case "upload": {
      const c = meta && typeof meta.count === "number" ? `（${meta.count}件）` : "";
      return `${actor} が明細をアップロードしました${c}`;
    }
    case "merchant_create": return `${actor} が加盟店「${t}」を登録しました`;
    case "payment_owner_set": return `${actor} が ${t}さんの決済オーナーを設定しました`;
    default: return `${actor} が操作を行いました`;
  }
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("認証されていません", "UNAUTHORIZED"), { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data: prof } = await admin.from("profiles").select("role, facility_id, merchant_id").eq("id", user.id).single();
  const role = ((user.app_metadata?.role as UserRole | undefined) ?? (prof?.role as UserRole | undefined)) ?? null;
  if (!role || !["admin", "facility_staff", "provider"].includes(role)) {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
  }
  const isAdmin = role === "admin";

  const url = req.nextUrl;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const filterAction = url.searchParams.get("action") || null;
  const filterFacility = url.searchParams.get("facilityId");
  const gte = from ? `${from}T00:00:00` : null;
  const lte = to ? `${to}T23:59:59` : null;

  const all: (Entry & { facilityId: string | null; merchantId: string | null; actorId: string | null })[] = [];

  // ── 決済ログ ──
  {
    let q = admin
      .from("payment_audit_logs")
      .select("id, payment_id, action, performed_by, created_at, request_body, response_body")
      .in("action", PAY_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (gte) q = q.gte("created_at", gte);
    if (lte) q = q.lte("created_at", lte);
    const { data: logs } = await q;
    const rows = logs ?? [];
    const paymentIds = Array.from(new Set(rows.map((r) => r.payment_id).filter((v): v is string => !!v)));
    const performerIds = Array.from(new Set(rows.map((r) => r.performed_by).filter((v): v is string => !!v)));
    const { data: payments } = paymentIds.length
      ? await admin.from("payments").select("id, total_amount, resident_id, merchant_id, payment_status").in("id", paymentIds)
      : { data: [] as { id: string; total_amount: number; resident_id: string; merchant_id: string; payment_status: string }[] };
    const paymentMap = new Map((payments ?? []).map((p) => [p.id, p]));
    const residentIds = Array.from(new Set((payments ?? []).map((p) => p.resident_id)));
    const { data: residents } = residentIds.length
      ? await admin.from("residents").select("id, name_last, name_first, facility_id").in("id", residentIds)
      : { data: [] as { id: string; name_last: string; name_first: string; facility_id: string }[] };
    const residentMap = new Map((residents ?? []).map((r) => [r.id, r]));
    const { data: actors } = performerIds.length
      ? await admin.from("profiles").select("id, display_name").in("id", performerIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    const actorMap = new Map((actors ?? []).map((a) => [a.id, a.display_name]));

    for (const r of rows) {
      const meta = PAY_META[r.action];
      const payment = r.payment_id ? paymentMap.get(r.payment_id) : null;
      const resident = payment ? residentMap.get(payment.resident_id) : null;
      const actor = (r.performed_by ? actorMap.get(r.performed_by) : null) || "システム";
      const name = resident ? `${resident.name_last} ${resident.name_first}` : null;
      const summary =
        name && payment?.total_amount != null
          ? `${actor} が ${name}さんの決済 ¥${payment.total_amount.toLocaleString("ja-JP")} を${meta.verb}しました`
          : r.action === "ec_checkout"
            ? `${actor} がカードを登録しました`
            : `${actor} が ${meta.label}を行いました`;
      all.push({
        id: r.id, action: r.action, actionLabel: meta.label, kind: meta.kind, summary,
        createdAt: r.created_at, detail: isAdmin ? { request: r.request_body, response: r.response_body } : null,
        facilityId: resident?.facility_id ?? null, merchantId: payment?.merchant_id ?? null, actorId: r.performed_by ?? null,
      });
    }
  }

  // ── 運用ログ（activity_logs。未作成でもエラーにしない） ──
  {
    let q = admin
      .from("activity_logs")
      .select("id, action, actor_id, actor_name, facility_id, target_label, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (gte) q = q.gte("created_at", gte);
    if (lte) q = q.lte("created_at", lte);
    const { data: acts, error: actErr } = await q;
    if (!actErr) {
      for (const a of acts ?? []) {
        const meta = ACT_META[a.action] ?? { label: a.action, kind: "info" as Kind };
        const actor = a.actor_name || "システム";
        all.push({
          id: a.id, action: a.action, actionLabel: meta.label, kind: meta.kind,
          summary: activitySummary(a.action, actor, a.target_label, a.metadata as Record<string, unknown> | null),
          createdAt: a.created_at, detail: isAdmin ? { metadata: a.metadata } : null,
          facilityId: a.facility_id ?? null, merchantId: null, actorId: a.actor_id ?? null,
        });
      }
    }
  }

  // ── 役割フィルタ＋アクション絞り込み＋整列 ──
  const entries = all
    .filter((e) => {
      if (filterAction && e.action !== filterAction) return false;
      if (role === "facility_staff") return e.facilityId && e.facilityId === prof?.facility_id;
      if (role === "provider") return (e.merchantId && e.merchantId === prof?.merchant_id) || e.actorId === user.id;
      if (filterFacility) return e.facilityId === filterFacility;
      return true;
    })
    .sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))
    .slice(0, 500)
    .map(({ facilityId: _f, merchantId: _m, actorId: _a, ...rest }) => rest);

  return NextResponse.json(apiOk({ entries, role }));
}
