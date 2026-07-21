/**
 * POST /api/admin/applications/[id]/review
 *
 * JCB / セゾンの審査結果（提出日・結果・結果受領日・NG理由・加盟店番号）を登録する。
 * - 保存先は applications.ud_input.review（変換前でも記録できる正本）
 * - 加盟店へ変換済み（merchant_id あり）の場合は merchants の加盟店番号列と
 *   merchant_applications（審査記録テーブル）へも同期する
 * - application_events に kind='review_registered'（before/after 付き）を必ず記録
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import {
  parseUdInput,
  serializeUdInput,
  mergeCompanyReview,
  type CompanyReview,
  type ReviewCompany,
} from "@/lib/applications/ud-input";
import { buildMerchantApplicationUpsert } from "@/lib/applications/convert";
import { apiError, apiOk } from "@/types/api";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付は YYYY-MM-DD 形式で入力してください")
  .nullable()
  .optional();

const bodySchema = z.object({
  company: z.enum(["jcb", "saison"]),
  submitted_at: dateSchema,
  result: z.enum(["approved", "rejected"]).nullable().optional(),
  result_received_at: dateSchema,
  ng_reason: z.string().trim().max(500).nullable().optional(),
  /** JCB: 登録型（会員ID決済・継続課金用）加盟店番号 */
  merchant_code_recurring: z.string().trim().max(17).nullable().optional(),
  /** JCB: 都度型EC（トークン決済用）加盟店番号 */
  merchant_code_ec: z.string().trim().max(17).nullable().optional(),
  /** セゾン: 加盟店番号（加盟店No. 通常7桁） */
  merchant_code: z.string().trim().max(7).nullable().optional(),
});

/** 空文字を null に正規化 */
function norm(v: string | null | undefined): string | null {
  return v == null || v.trim() === "" ? null : v.trim();
}

/** 審査結果を1社分登録する */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
  const company = v.company as ReviewCompany;

  const admin = getSupabaseAdminClient();
  const { data: app, error: appErr } = await admin
    .from("applications")
    .select("id, source, merchant_id, ud_input")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (appErr) {
    return NextResponse.json(
      apiError(
        `取得に失敗しました（ud_input 列未適用の可能性があります）: ${appErr.message}`,
        "DB"
      ),
      { status: 500 }
    );
  }
  if (!app) {
    return NextResponse.json(apiError("申請が見つかりません", "NOT_FOUND"), { status: 404 });
  }
  const application = app as {
    id: string;
    source: string;
    merchant_id: string | null;
    ud_input: Record<string, unknown> | null;
  };
  if (application.source !== "qolc_merchant") {
    return NextResponse.json(
      apiError("審査結果は加盟店申請の案件にのみ登録できます", "BAD_REQUEST"),
      { status: 400 }
    );
  }

  // ud_input.review を1社分だけ差し替え（before/after を履歴に残す）
  const { fields, review: beforeReview, codes } = parseUdInput(application.ud_input);
  const nextCompany: CompanyReview = {
    submitted_at: norm(v.submitted_at),
    result: v.result ?? null,
    result_received_at: norm(v.result_received_at),
    ng_reason: norm(v.ng_reason),
    merchant_code_recurring: company === "jcb" ? norm(v.merchant_code_recurring) : null,
    merchant_code_ec: company === "jcb" ? norm(v.merchant_code_ec) : null,
    merchant_code: company === "saison" ? norm(v.merchant_code) : null,
  };
  const afterReview = mergeCompanyReview(beforeReview, company, nextCompany);
  // codes（申請前採番）を必ず引き継ぐ（落とすと申請書・変換への配線が切れる）
  const nextUdInput = serializeUdInput(fields, afterReview, codes);

  const { error: updErr } = await admin
    .from("applications")
    .update({ ud_input: nextUdInput })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json(apiError(`保存に失敗しました: ${updErr.message}`, "DB"), {
      status: 500,
    });
  }

  const { error: evErr } = await admin.from("application_events").insert({
    application_id: params.id,
    actor_id: auth.user.id,
    kind: "review_registered",
    detail: {
      company,
      before: beforeReview[company] ?? null,
      after: nextCompany,
    },
  });
  if (evErr) {
    return NextResponse.json(apiError(`履歴の記録に失敗しました: ${evErr.message}`, "DB"), {
      status: 500,
    });
  }

  // 変換済みの場合は merchants / merchant_applications にも同期する
  if (application.merchant_id) {
    const syncErr = await syncMerchantRecords(params.id, application.merchant_id, afterReview);
    if (syncErr) {
      return NextResponse.json(apiError(syncErr, "DB"), { status: 500 });
    }
  }

  return NextResponse.json(apiOk({ id: params.id }));
}

/**
 * 審査結果を merchants の加盟店番号列と merchant_applications へ同期する。
 * @returns エラーメッセージ（成功時は null）
 */
async function syncMerchantRecords(
  applicationId: string,
  merchantId: string,
  review: ReturnType<typeof parseUdInput>["review"]
): Promise<string | null> {
  const admin = getSupabaseAdminClient();

  const { error: merErr } = await admin
    .from("merchants")
    .update({
      jcb_merchant_code_recurring: review.jcb?.merchant_code_recurring ?? null,
      jcb_merchant_code_ec: review.jcb?.merchant_code_ec ?? null,
      saison_merchant_code: review.saison?.merchant_code ?? null,
    })
    .eq("id", merchantId);
  if (merErr) return `加盟店番号の同期に失敗しました: ${merErr.message}`;

  const row = buildMerchantApplicationUpsert(review, merchantId, applicationId);
  const { data: existing, error: selErr } = await admin
    .from("merchant_applications")
    .select("id")
    .eq("application_id", applicationId)
    .eq("merchant_id", merchantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (selErr) return `審査記録の取得に失敗しました: ${selErr.message}`;

  if (existing) {
    const { error } = await admin
      .from("merchant_applications")
      .update(row)
      .eq("id", (existing as { id: string }).id);
    if (error) return `審査記録の更新に失敗しました: ${error.message}`;
  } else {
    const { error } = await admin.from("merchant_applications").insert(row);
    if (error) return `審査記録の作成に失敗しました: ${error.message}`;
  }
  return null;
}
