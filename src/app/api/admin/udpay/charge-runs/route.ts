/**
 * GET /api/admin/udpay/charge-runs — 毎朝の自動課金の実行記録（直近14回・UD管理者のみ）
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

/** 実行記録1件 */
interface ChargeRun {
  at: string;
  date: string;
  captured: number;
  failed: number;
  unknown: number;
  recovered: number;
  error: string | null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  const { data, error } = await getSupabaseAdminClient()
    .from("activity_logs")
    .select("created_at, metadata")
    .eq("action", "udpay_charge_run")
    .order("created_at", { ascending: false })
    .limit(14);
  if (error) return NextResponse.json(apiError(error.message), { status: 500 });
  const runs: ChargeRun[] = (data ?? []).map((r) => {
    const m = (r.metadata ?? {}) as Record<string, unknown>;
    const n = (k: string) => (typeof m[k] === "number" ? (m[k] as number) : 0);
    return {
      at: r.created_at as string,
      date: String(m.date ?? ""),
      captured: n("captured"),
      failed: n("failed"),
      unknown: n("unknown"),
      recovered: n("recovered"),
      error: typeof m.error === "string" ? m.error : null,
    };
  });
  return NextResponse.json(apiOk(runs));
}
