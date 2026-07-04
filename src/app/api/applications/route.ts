/**
 * POST /api/applications
 *
 * 公開申請 intake エンドポイント（認証不要）。
 * - QOLC加盟店申請(/site/apply)・JCB住み替え相談(/site/jcb)・
 *   一般お問い合わせ(/site/contact) など全 source の一元受け皿
 *   （許可 source は applicationSourceSchema＝DB ENUM と1対1で管理）。
 * - 入力を zod で厳格検証し、service_role クライアントで RLS をバイパスして保存する。
 * - 保存成功後、申請者メールアドレスがあれば受付自動返信メールを送信し、
 *   結果を application_events（kind='email_sent'）に記録する。
 *   メールの失敗・スキップでも受付処理は成功として返す。
 * - 簡易レートリミットで連投を抑止する。
 * - 例外時も内部情報を漏らさず汎用メッセージを返す。
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";
import { applicationIntakeSchema } from "@/lib/applications/schema";
import { sendApplicationReceivedEmail } from "@/lib/applications/intake-email";
import { checkRateLimit } from "@/lib/rate-limit";

/** payload を含むリクエストボディ全体のサイズ上限（バイト）。 */
const MAX_BODY_BYTES = 20 * 1024;

/**
 * リクエストからクライアントIP（相当）を推定する。
 * @param req リクエスト
 * @returns 識別に使うIP文字列
 */
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // レートリミット（同一IPから60秒に5回まで）
  const rate = checkRateLimit(`applications:${clientIp(req)}`);
  if (!rate.allowed) {
    return NextResponse.json(
      apiError("送信回数が多すぎます。しばらく経ってから再度お試しください", "RATE_LIMITED"),
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  // ボディ読み取り＋サイズ上限（20KB超は413）
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(apiError("入力が大きすぎます", "PAYLOAD_TOO_LARGE"), { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }

  const parsed = applicationIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }
  const input = parsed.data;

  try {
    const admin = getSupabaseAdminClient();

    const { data: created, error: insertError } = await admin
      .from("applications")
      .insert({
        source: input.source,
        applicant_name: input.applicant_name ?? null,
        applicant_org: input.applicant_org ?? null,
        applicant_email: input.applicant_email ?? null,
        applicant_phone: input.applicant_phone ?? null,
        message: input.message ?? null,
        payload: input.payload ?? {},
        // status/priority はDB既定値（new/normal）に委ねる
      })
      .select("id")
      .single();

    if (insertError || !created) {
      // 内部エラー詳細はレスポンスに含めない
      return NextResponse.json(apiError("送信に失敗しました。時間をおいて再度お試しください", "INTERNAL"), {
        status: 500,
      });
    }

    // タイムライン初期イベント（作成）。失敗しても申請自体は成功として扱う。
    await admin.from("application_events").insert({
      application_id: created.id,
      actor_id: null,
      kind: "created",
      detail: { source: input.source },
    });

    // 受付自動返信メール（結果は email_sent イベントに記録される）。
    // sendApplicationReceivedEmail は throw しない設計のため、
    // メールの失敗・スキップに関わらず受付は成功として返す。
    if (input.applicant_email) {
      await sendApplicationReceivedEmail(admin, {
        applicationId: created.id as string,
        source: input.source,
        applicantName: input.applicant_name ?? null,
        to: input.applicant_email,
      });
    }

    return NextResponse.json(apiOk({ id: created.id as string }));
  } catch {
    return NextResponse.json(apiError("送信に失敗しました。時間をおいて再度お試しください", "INTERNAL"), {
      status: 500,
    });
  }
}
