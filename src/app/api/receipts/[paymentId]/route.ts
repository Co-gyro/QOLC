/**
 * GET /api/receipts/[paymentId]
 *
 * 決済1件の「利用料請求書兼領収書」PDFをその場生成して返す。
 * 認可:
 *   - admin          : 全件
 *   - provider       : 自加盟店(merchant)の決済のみ
 *   - facility_staff : 自施設の入居者の決済のみ
 *   - family         : 自分が紐づく入居者(resident_accounts)の決済のみ
 *
 * クエリ ?type=kaigo|iryou|jihi でカテゴリを上書き可（未指定は給付額から自動判定）。
 *
 * 注: 日本語フォントが必要（RECEIPT_FONT_PATH もしくは public/fonts 配置）。
 *     未配置の場合は日本語が□になる。詳細は docs/operations-runbook.md 2.4。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateReceiptPdf } from "@/lib/pdf/receipt-generator";
import { buildReceiptInputFromPayment } from "@/lib/pdf/receipt-input-builder";
import type { ReceiptCategory } from "@/lib/pdf/receipt-model";
import { apiError } from "@/types/api";
import type { UserRole } from "@/types";

const VALID_CATEGORIES: ReceiptCategory[] = ["kaigo", "iryou", "jihi"];

export async function GET(
  req: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(apiError("認証されていません", "UNAUTHORIZED"), { status: 401 });
  }

  const role =
    (user.app_metadata?.role as UserRole | undefined) ??
    ((await supabase.from("profiles").select("role").eq("id", user.id).single()).data?.role as
      | UserRole
      | undefined);
  if (!role) {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, merchant_id, resident_id, total_amount, payment_status, usen_jutyu_cd, captured_at, created_at")
    .eq("id", params.paymentId)
    .maybeSingle();
  if (!payment) {
    return NextResponse.json(apiError("決済が見つかりません", "NOT_FOUND"), { status: 404 });
  }

  // 領収書は売上計上済み（captured 以降）でのみ発行
  if (!["captured", "refunded"].includes(payment.payment_status)) {
    return NextResponse.json(
      apiError("この決済はまだ領収書を発行できません（未計上）", "NOT_CAPTURED"),
      { status: 409 }
    );
  }

  // 認可（ロール別）
  const authorized = await isAuthorized(admin, role, user.id, payment);
  if (!authorized) {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
  }

  // 関連データ取得
  const [{ data: lines }, { data: resident }, { data: merchant }] = await Promise.all([
    admin
      .from("statement_lines")
      .select("amount, self_pay_amount, service_name, quantity")
      .eq("payment_id", payment.id),
    admin
      .from("residents")
      .select("name_last, name_first, facility_id")
      .eq("id", payment.resident_id)
      .maybeSingle(),
    admin
      .from("merchants")
      .select("name, address, phone, invoice_registration_number, receipt_category")
      .eq("id", payment.merchant_id)
      .maybeSingle(),
  ]);

  if (!resident || !merchant) {
    return NextResponse.json(apiError("領収書の生成に必要な情報が不足しています", "DATA_INCOMPLETE"), { status: 500 });
  }

  const facility = resident.facility_id
    ? (await admin.from("facilities").select("name, address").eq("id", resident.facility_id).maybeSingle()).data
    : null;

  // カテゴリの決定: ?type= 上書き > 加盟店の既定区分(receipt_category) > 給付額からの自動判定
  const typeParam = req.nextUrl.searchParams.get("type");
  const merchantCategory =
    merchant.receipt_category && (VALID_CATEGORIES as string[]).includes(merchant.receipt_category)
      ? (merchant.receipt_category as ReceiptCategory)
      : undefined;
  const category =
    typeParam && (VALID_CATEGORIES as string[]).includes(typeParam)
      ? (typeParam as ReceiptCategory)
      : merchantCategory;

  const input = buildReceiptInputFromPayment({
    payment: {
      total_amount: payment.total_amount,
      captured_at: payment.captured_at,
      created_at: payment.created_at,
    },
    lines: lines ?? [],
    resident: { name_last: resident.name_last ?? "", name_first: resident.name_first ?? "" },
    merchant: { name: merchant.name, address: merchant.address, phone: merchant.phone },
    facility,
    category,
    documentNo: payment.usen_jutyu_cd ?? undefined,
    invoiceRegistrationNumber: merchant.invoice_registration_number ?? undefined,
    issuedAtIso: new Date().toISOString(),
  });

  let pdf: Uint8Array;
  try {
    pdf = await generateReceiptPdf(input);
  } catch (e) {
    const message = e instanceof Error ? e.message : "PDF生成に失敗しました";
    return NextResponse.json(apiError(`領収書PDFの生成に失敗しました: ${message}`, "PDF_ERROR"), { status: 500 });
  }

  const fileName = `receipt-${payment.id}.pdf`;
  return new NextResponse(pdf as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** ロール別の認可判定 */
async function isAuthorized(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  role: UserRole,
  userId: string,
  payment: { merchant_id: string; resident_id: string }
): Promise<boolean> {
  if (role === "admin") return true;

  if (role === "provider") {
    const { data: prof } = await admin.from("profiles").select("merchant_id").eq("id", userId).single();
    return prof?.merchant_id === payment.merchant_id;
  }

  if (role === "facility_staff") {
    const [{ data: prof }, { data: resident }] = await Promise.all([
      admin.from("profiles").select("facility_id").eq("id", userId).single(),
      admin.from("residents").select("facility_id").eq("id", payment.resident_id).maybeSingle(),
    ]);
    return Boolean(prof?.facility_id) && prof?.facility_id === resident?.facility_id;
  }

  if (role === "family") {
    const { data: account } = await admin
      .from("resident_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("resident_id", payment.resident_id)
      .is("deleted_at", null)
      .maybeSingle();
    return Boolean(account);
  }

  return false;
}
