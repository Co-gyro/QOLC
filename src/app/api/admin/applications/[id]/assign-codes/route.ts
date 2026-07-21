/**
 * POST /api/admin/applications/[id]/assign-codes
 *
 * 加盟店申請の「申請前採番」: モールコード・端末識別番号をプールから払い出し、
 * applications.ud_input.codes に保存する（申請書生成・審査後の加盟店変換が同じ値を使う）。
 * - 冪等: 採番済みなら既存の値を返す（プールを消費しない）
 * - 競合: 条件付き UPDATE（codes 未設定の行のみ）で先取りロックし、
 *   負けた側は払い出したコードをプールへ返却して勝者の値を返す
 * - 監査: application_events（kind=codes_assigned）へ記録
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import { apiError, apiOk } from "@/types/api";
import { parseUdInput, serializeUdInput, type AssignedCodes } from "@/lib/applications/ud-input";

/** 払い出し済みコードをプールへ返す（競合に負けたときの後始末。失敗しても致命ではない） */
async function releaseCodes(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  mallCode: string | null,
  terminalId: string | null
): Promise<void> {
  if (mallCode) {
    await admin
      .from("mall_code_pool")
      .update({ status: "available", assigned_to_merchant_id: null, assigned_at: null })
      .eq("code", mallCode);
  }
  if (terminalId) {
    await admin
      .from("terminal_id_pool")
      .update({ status: "available", assigned_to_merchant_id: null, assigned_at: null })
      .eq("terminal_id", terminalId);
  }
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: app, error: appErr } = await admin
    .from("applications")
    .select("id, source, ud_input")
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
    ud_input: Record<string, unknown> | null;
  };
  if (application.source !== "qolc_merchant") {
    return NextResponse.json(
      apiError("採番は加盟店申請の案件のみ実行できます", "BAD_REQUEST"),
      { status: 400 }
    );
  }

  // 冪等: 採番済みならプールを消費せず既存値を返す
  const current = parseUdInput(application.ud_input);
  if (current.codes) {
    return NextResponse.json(
      apiOk({ mallCode: current.codes.mall_code, terminalId: current.codes.terminal_id, already: true })
    );
  }

  // プール払い出し（merchant 未作成のため p_merchant_id は null。
  // 加盟店変換時にプール行へ merchant_id を紐付け直す）
  const { data: mallData, error: mallErr } = await admin.rpc("assign_mall_code", {
    p_merchant_id: null,
  });
  if (mallErr) {
    return NextResponse.json(
      apiError(`モールコード払い出し失敗: ${mallErr.message}`, "MALL_CODE"),
      { status: 409 }
    );
  }
  const mallCode = mallData as string;

  const { data: termData, error: termErr } = await admin.rpc("assign_terminal_id", {
    p_merchant_id: null,
  });
  if (termErr) {
    await releaseCodes(admin, mallCode, null);
    return NextResponse.json(
      apiError(`端末識別番号払い出し失敗: ${termErr.message}`, "TERMINAL_ID"),
      { status: 409 }
    );
  }
  const terminalId = termData as string;

  const codes: AssignedCodes = {
    mall_code: mallCode,
    terminal_id: terminalId,
    assigned_at: new Date().toISOString(),
  };
  const nextUdInput = serializeUdInput(current.fields, current.review, codes);

  // 条件付き UPDATE（codes 未設定の行のみ）＝同時実行の先取りロック
  const { data: updated, error: updErr } = await admin
    .from("applications")
    .update({ ud_input: nextUdInput })
    .eq("id", params.id)
    .is("ud_input->codes", null)
    .select("id");
  if (updErr) {
    await releaseCodes(admin, mallCode, terminalId);
    return NextResponse.json(apiError(`採番の保存に失敗しました: ${updErr.message}`, "DB"), {
      status: 500,
    });
  }
  if (!updated || updated.length === 0) {
    // 別の管理者が先に採番した: 自分の払い出し分を返却し、勝者の値を返す
    await releaseCodes(admin, mallCode, terminalId);
    const { data: re } = await admin
      .from("applications")
      .select("ud_input")
      .eq("id", params.id)
      .maybeSingle();
    const winner = parseUdInput((re as { ud_input: Record<string, unknown> | null } | null)?.ud_input);
    if (winner.codes) {
      return NextResponse.json(
        apiOk({ mallCode: winner.codes.mall_code, terminalId: winner.codes.terminal_id, already: true })
      );
    }
    return NextResponse.json(apiError("採番が競合しました。再読み込みしてください", "CONFLICT"), {
      status: 409,
    });
  }

  // 監査: 誰がいつ何を採番したか
  await admin.from("application_events").insert({
    application_id: params.id,
    actor_id: auth.user.id,
    kind: "codes_assigned",
    detail: { mall_code: mallCode, terminal_id: terminalId },
  });

  return NextResponse.json(apiOk({ mallCode, terminalId, already: false }));
}
