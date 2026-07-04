/**
 * POST /api/admin/applications/[id]/convert
 *
 * 審査通過した加盟店申請を merchants レコードへ変換する。
 * - payload（顧客入力）+ ud_input（UD追記）+ 審査結果から merchants を作成
 *   （既存 POST /api/admin/merchants のパターンを踏襲。プール払い出しも同じ RPC）
 * - merchant_applications に審査記録を作成（application_id で紐付け）
 * - applications.merchant_id 設定 + status='done'
 * - application_events に kind='converted'（理由メモ付き）、activity_logs にも記録
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import { parseUdInput } from "@/lib/applications/ud-input";
import {
  pickMerchantApplyPayload,
  buildMerchantInsert,
  buildMerchantApplicationUpsert,
  validateConvertPreconditions,
} from "@/lib/applications/convert";
import { logActivity } from "@/lib/audit/activity-log";
import { apiError, apiOk } from "@/types/api";

const bodySchema = z.object({
  /** 変換の理由・メモ（converted イベントに記録） */
  note: z.string().trim().max(500).optional(),
  /** USEN モールコード（A300〜）をプールから払い出すか */
  assign_mall_code: z.boolean().optional(),
  /** USEN 端末識別番号をプールから払い出すか */
  assign_terminal_id: z.boolean().optional(),
});

/** 申請を加盟店として登録する */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // ボディなし（note 省略）も許容する
  }
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }
  const v = parsed.data;

  const admin = getSupabaseAdminClient();
  const { data: app, error: appErr } = await admin
    .from("applications")
    .select("id, source, status, merchant_id, payload, ud_input")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (appErr) {
    return NextResponse.json(apiError(`取得に失敗しました: ${appErr.message}`, "DB"), {
      status: 500,
    });
  }
  if (!app) {
    return NextResponse.json(apiError("申請が見つかりません", "NOT_FOUND"), { status: 404 });
  }
  const application = app as {
    id: string;
    source: string;
    status: string;
    merchant_id: string | null;
    payload: Record<string, unknown> | null;
    ud_input: Record<string, unknown> | null;
  };
  if (application.source !== "qolc_merchant") {
    return NextResponse.json(
      apiError("加盟店への変換は加盟店申請の案件のみ実行できます", "BAD_REQUEST"),
      { status: 400 }
    );
  }

  const { fields, review } = parseUdInput(application.ud_input);
  const precondition = validateConvertPreconditions({
    merchantId: application.merchant_id,
    review,
    fields,
  });
  if (precondition) {
    const status = application.merchant_id ? 409 : 400;
    return NextResponse.json(apiError(precondition, "PRECONDITION"), { status });
  }

  // merchants 作成（payload + 審査結果の加盟店番号を転記）
  let insertRow;
  try {
    insertRow = buildMerchantInsert(pickMerchantApplyPayload(application.payload), review);
  } catch (e) {
    return NextResponse.json(
      apiError(e instanceof Error ? e.message : "変換に失敗しました", "BAD_REQUEST"),
      { status: 400 }
    );
  }
  const { data: merchant, error: insErr } = await admin
    .from("merchants")
    .insert(insertRow)
    .select("id")
    .single();
  if (insErr || !merchant) {
    return NextResponse.json(
      apiError(`加盟店の作成に失敗しました: ${insErr?.message ?? "unknown"}`, "DB"),
      { status: 500 }
    );
  }
  const merchantId = merchant.id as string;

  // プール払い出し（既存 merchants API と同じ RPC。原子的・重複防止）
  let mallCode: string | null = null;
  let terminalId: string | null = null;
  if (v.assign_mall_code) {
    const { data, error } = await admin.rpc("assign_mall_code", { p_merchant_id: merchantId });
    if (error) {
      return NextResponse.json(
        apiError(`モールコード払い出し失敗: ${error.message}`, "MALL_CODE"),
        { status: 409 }
      );
    }
    mallCode = data as string;
  }
  if (v.assign_terminal_id) {
    const { data, error } = await admin.rpc("assign_terminal_id", { p_merchant_id: merchantId });
    if (error) {
      return NextResponse.json(
        apiError(`端末識別番号払い出し失敗: ${error.message}`, "TERMINAL_ID"),
        { status: 409 }
      );
    }
    terminalId = data as string;
  }

  // 審査記録（merchant_applications）を作成
  const maRow = buildMerchantApplicationUpsert(review, merchantId, params.id);
  const { error: maErr } = await admin.from("merchant_applications").insert(maRow);
  if (maErr) {
    return NextResponse.json(
      apiError(`審査記録の作成に失敗しました: ${maErr.message}`, "DB"),
      { status: 500 }
    );
  }

  // 申請本体を完了へ（merchant_id 紐付け + status=done）
  const { error: updErr } = await admin
    .from("applications")
    .update({ merchant_id: merchantId, status: "done" })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json(apiError(`申請の更新に失敗しました: ${updErr.message}`, "DB"), {
      status: 500,
    });
  }

  // タイムライン（converted）+ 状態変更の記録
  const { error: evErr } = await admin.from("application_events").insert([
    {
      application_id: params.id,
      actor_id: auth.user.id,
      kind: "converted",
      detail: {
        merchant_id: merchantId,
        merchant_name: insertRow.name,
        note: v.note?.trim() || null,
        mall_code: mallCode,
        terminal_id: terminalId,
      },
    },
    {
      application_id: params.id,
      actor_id: auth.user.id,
      kind: "status_changed",
      detail: { from: application.status, to: "done" },
    },
  ]);
  if (evErr) {
    return NextResponse.json(apiError(`履歴の記録に失敗しました: ${evErr.message}`, "DB"), {
      status: 500,
    });
  }

  // 運用操作ログ（決済以外の管理操作の監査）
  await logActivity({
    actorId: auth.user.id,
    action: "merchant_create",
    targetType: "merchant",
    targetId: merchantId,
    targetLabel: insertRow.name,
    metadata: { from_application: params.id, mallCode, terminalId, note: v.note ?? null },
  });

  return NextResponse.json(apiOk({ merchantId, mallCode, terminalId }));
}
