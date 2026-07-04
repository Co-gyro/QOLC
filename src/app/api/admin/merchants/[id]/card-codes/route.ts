/**
 * PATCH /api/admin/merchants/[id]/card-codes
 *
 * 加盟店のカード会社番号（JCB 2種 + セゾン）を更新する。
 * - JCB は施設ごとに「登録型（会員ID決済・継続課金用）」と「都度型EC（トークン決済用）」の
 *   2種類の加盟店番号が発番される（migration 032 で用途をコメント確定済み）
 * - admin のみ。変更は activity_logs に before/after 付きで記録する
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import { logActivity } from "@/lib/audit/activity-log";
import { apiError, apiOk } from "@/types/api";

const codeSchema = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}は${max}文字以内で入力してください`)
    .regex(/^[0-9]*$/, `${label}は半角数字で入力してください`)
    .nullable()
    .optional();

const bodySchema = z
  .object({
    jcb_merchant_code_recurring: codeSchema(17, "JCB加盟店番号（登録型）"),
    jcb_merchant_code_ec: codeSchema(17, "JCB加盟店番号（都度型EC）"),
    saison_merchant_code: codeSchema(7, "セゾン加盟店番号"),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "更新項目がありません" });

/** カード会社番号を更新する */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "入力検証エラー";
    return NextResponse.json(apiError(first, "VALIDATION_ERROR"), { status: 400 });
  }
  const v = parsed.data;

  const admin = getSupabaseAdminClient();
  const { data: before, error: beforeErr } = await admin
    .from("merchants")
    .select("id, name, jcb_merchant_code_recurring, jcb_merchant_code_ec, saison_merchant_code")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (beforeErr) {
    return NextResponse.json(apiError(`取得に失敗しました: ${beforeErr.message}`, "DB"), {
      status: 500,
    });
  }
  if (!before) {
    return NextResponse.json(apiError("加盟店が見つかりません", "NOT_FOUND"), { status: 404 });
  }
  const prev = before as {
    id: string;
    name: string;
    jcb_merchant_code_recurring: string | null;
    jcb_merchant_code_ec: string | null;
    saison_merchant_code: string | null;
  };

  const norm = (x: string | null | undefined): string | null =>
    x == null || x.trim() === "" ? null : x.trim();
  const updates: Record<string, string | null> = {};
  if (v.jcb_merchant_code_recurring !== undefined) {
    updates.jcb_merchant_code_recurring = norm(v.jcb_merchant_code_recurring);
  }
  if (v.jcb_merchant_code_ec !== undefined) {
    updates.jcb_merchant_code_ec = norm(v.jcb_merchant_code_ec);
  }
  if (v.saison_merchant_code !== undefined) {
    updates.saison_merchant_code = norm(v.saison_merchant_code);
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(apiError("変更内容がありません", "NO_CHANGE"), { status: 400 });
  }

  const { error: updErr } = await admin.from("merchants").update(updates).eq("id", params.id);
  if (updErr) {
    return NextResponse.json(apiError(`更新に失敗しました: ${updErr.message}`, "DB"), {
      status: 500,
    });
  }

  // 監査ログ（before/after）
  await logActivity({
    actorId: auth.user.id,
    action: "merchant_update_card_codes",
    targetType: "merchant",
    targetId: params.id,
    targetLabel: prev.name,
    metadata: {
      before: {
        jcb_merchant_code_recurring: prev.jcb_merchant_code_recurring,
        jcb_merchant_code_ec: prev.jcb_merchant_code_ec,
        saison_merchant_code: prev.saison_merchant_code,
      },
      after: updates,
    },
  });

  return NextResponse.json(apiOk({ id: params.id, updated: Object.keys(updates) }));
}
