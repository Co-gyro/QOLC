/**
 * GET /api/logs
 *
 * 決済の監査ログ（payment_audit_logs）を、役割に応じて自然文表示用に整形して返す。
 *   - admin         : 全施設（?facilityId で絞り込み可）
 *   - facility_staff : 自施設の入居者に関するログのみ
 *   - provider       : 自加盟店の決済ログのみ
 * 改ざん防止のため読み取り専用。生データ(JSON)は admin のみ含める。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

/** 利用者に見せる「意味のある操作」と表示属性。低レベルAPI呼出は除外。 */
const ACTION_META: Record<string, { label: string; verb: string; kind: "success" | "warn" | "info" }> = {
  sales_add: { label: "決済実行", verb: "実行", kind: "success" },
  sales_cancel: { label: "決済取消", verb: "取消", kind: "warn" },
  sales_return: { label: "返金", verb: "返金", kind: "warn" },
  auth_void: { label: "与信取消", verb: "取消", kind: "warn" },
  ec_checkout: { label: "カード登録", verb: "登録", kind: "info" },
};
const MEANINGFUL_ACTIONS = Object.keys(ACTION_META);

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(apiError("認証されていません", "UNAUTHORIZED"), { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("role, facility_id, merchant_id")
    .eq("id", user.id)
    .single();
  const role = ((user.app_metadata?.role as UserRole | undefined) ?? (prof?.role as UserRole | undefined)) ?? null;
  if (!role || !["admin", "facility_staff", "provider"].includes(role)) {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
  }
  const isAdmin = role === "admin";

  const url = req.nextUrl;
  const from = url.searchParams.get("from"); // yyyy-mm-dd
  const to = url.searchParams.get("to");
  const filterAction = url.searchParams.get("action"); // 単一アクション or null
  const filterFacility = url.searchParams.get("facilityId"); // admin用

  let q = admin
    .from("payment_audit_logs")
    .select("id, payment_id, action, performed_by, created_at, request_body, response_body")
    .in("action", filterAction && MEANINGFUL_ACTIONS.includes(filterAction) ? [filterAction] : MEANINGFUL_ACTIONS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (from) q = q.gte("created_at", `${from}T00:00:00`);
  if (to) q = q.lte("created_at", `${to}T23:59:59`);
  const { data: logs, error } = await q;
  if (error) {
    return NextResponse.json(apiError(`ログ取得に失敗しました: ${error.message}`, "DB_ERROR"), { status: 500 });
  }
  const rows = logs ?? [];

  // 関連データを一括取得
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

  const entries = rows
    .map((r) => {
      const meta = ACTION_META[r.action];
      const payment = r.payment_id ? paymentMap.get(r.payment_id) : null;
      const resident = payment ? residentMap.get(payment.resident_id) : null;
      return {
        id: r.id,
        action: r.action,
        actionLabel: meta?.label ?? r.action,
        verb: meta?.verb ?? "",
        kind: meta?.kind ?? "info",
        actorName: (r.performed_by ? actorMap.get(r.performed_by) : null) || "システム",
        residentName: resident ? `${resident.name_last} ${resident.name_first}` : null,
        amount: payment?.total_amount ?? null,
        status: payment?.payment_status ?? null,
        facilityId: resident?.facility_id ?? null,
        merchantId: payment?.merchant_id ?? null,
        createdAt: r.created_at,
        // 生データは admin のみ
        detail: isAdmin ? { request: r.request_body, response: r.response_body } : null,
      };
    })
    .filter((e) => {
      if (role === "facility_staff") return e.facilityId && e.facilityId === prof?.facility_id;
      if (role === "provider") return e.merchantId && e.merchantId === prof?.merchant_id;
      if (filterFacility) return e.facilityId === filterFacility; // admin の任意絞り込み
      return true;
    });

  return NextResponse.json(apiOk({ entries, role }));
}
