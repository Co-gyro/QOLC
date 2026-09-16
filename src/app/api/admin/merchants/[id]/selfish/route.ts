/**
 * /api/admin/merchants/[id]/selfish
 *
 * GET  … Selfish（精算システム）登録データを組み立てて返す（登録票・チェックリスト用）
 * POST … 同じデータを Selfish の連携 API へ送信する（HMAC 署名付き）
 *
 * - admin のみ
 * - 送信データはクライアントから受け取らず、必ずサーバー側で再構築する
 * - 不足項目（error）があれば送信しない。連携先が未設定なら送信しない（サイレント成功にしない）
 * - 結果は application_events（kind=selfish_registered / selfish_failed）と activity_logs に記録
 */
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import { logActivity } from "@/lib/audit/activity-log";
import { apiError, apiOk } from "@/types/api";
import { loadSelfishSource } from "@/lib/selfish/load-source";
import { getSelfishConfig, registerMerchantToSelfish } from "@/lib/selfish/client";

/** 登録データとチェックリストを返す */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }
  try {
    const loaded = await loadSelfishSource(params.id);
    if (!loaded) {
      return NextResponse.json(apiError("加盟店が見つかりません", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(
      apiOk({
        merchant_name: loaded.merchantName,
        application_id: loaded.applicationId,
        payload: loaded.build.payload,
        issues: loaded.build.issues,
        ready: loaded.build.ready,
        configured: getSelfishConfig() !== null,
        last: loaded.last,
      })
    );
  } catch (e) {
    return NextResponse.json(
      apiError(e instanceof Error ? e.message : "取得に失敗しました", "DB"),
      { status: 500 }
    );
  }
}

/** Selfish へ送信する */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }
  const config = getSelfishConfig();
  if (!config) {
    return NextResponse.json(
      apiError(
        "Selfish 連携が未設定です（SELFISH_API_BASE_URL / SELFISH_PARTNER_KEY）。登録データをコピーして手動登録してください",
        "NOT_CONFIGURED"
      ),
      { status: 503 }
    );
  }

  let loaded;
  try {
    loaded = await loadSelfishSource(params.id);
  } catch (e) {
    return NextResponse.json(
      apiError(e instanceof Error ? e.message : "取得に失敗しました", "DB"),
      { status: 500 }
    );
  }
  if (!loaded) {
    return NextResponse.json(apiError("加盟店が見つかりません", "NOT_FOUND"), { status: 404 });
  }
  if (!loaded.build.ready) {
    const missing = loaded.build.issues
      .filter((i) => i.level === "error")
      .map((i) => i.label)
      .join("、");
    return NextResponse.json(
      apiError(`不足項目があるため送信できません: ${missing}`, "NOT_READY"),
      { status: 409 }
    );
  }

  const result = await registerMerchantToSelfish(config, loaded.build.payload, auth.user.email ?? null);

  // 記録（成功・失敗とも）。履歴は元申請に紐づける（無ければ activity_logs のみ）
  const admin = getSupabaseAdminClient();
  const detail = result.ok
    ? { result: result.result, request_id: result.request_id, selfish_merchant_id: result.merchant_id ?? null }
    : { result: "failed", code: result.code, message: result.message, request_id: result.request_id };
  if (loaded.applicationId) {
    await admin.from("application_events").insert({
      application_id: loaded.applicationId,
      actor_id: auth.user.id,
      kind: result.ok ? "selfish_registered" : "selfish_failed",
      detail,
    });
  }
  await logActivity({
    actorId: auth.user.id,
    action: result.ok ? "merchant_selfish_register" : "merchant_selfish_register_failed",
    targetType: "merchant",
    targetId: params.id,
    targetLabel: loaded.merchantName,
    metadata: { ...detail, card_numbers: loaded.build.payload.card_numbers },
  });

  if (!result.ok) {
    const status = result.code === "needs_approval" || result.code === "conflict" ? 409 : 502;
    return NextResponse.json(apiError(result.message, `SELFISH_${result.code}`), { status });
  }
  return NextResponse.json(
    apiOk({ result: result.result, request_id: result.request_id, selfish_merchant_id: result.merchant_id ?? null })
  );
}
