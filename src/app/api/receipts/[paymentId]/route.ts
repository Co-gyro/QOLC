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
import {
  generateReceiptPdf,
  uploadReceiptPdf,
  downloadReceiptPdf,
} from "@/lib/pdf/receipt-generator";
import {
  buildReceiptInputFromPayment,
  buildKaigoDetailLines,
  buildIryouDetailLines,
} from "@/lib/pdf/receipt-input-builder";
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

  // 永続化済みの領収書があれば保存PDFを配信（その場再生成しない）。
  // admin が ?refresh=1 を指定したときのみ再生成して上書きする。
  const refresh = role === "admin" && req.nextUrl.searchParams.get("refresh") === "1";
  const { data: existing } = await admin
    .from("receipts")
    .select("id, pdf_path")
    .eq("payment_id", payment.id)
    .maybeSingle();
  if (existing?.pdf_path && !refresh) {
    try {
      const stored = await downloadReceiptPdf(existing.pdf_path);
      return pdfResponse(stored, payment.id);
    } catch {
      // 保存物が取得できない場合は再生成にフォールバック
    }
  }

  // 関連データ取得（statement_lines は migration026未適用でも動くようフォールバック）
  const [linesRes, { data: resident }, { data: merchant }] = await Promise.all([
    admin
      .from("statement_lines")
      .select("id, amount, self_pay_amount, service_name, quantity, cost_kind, tax_10_amount, tax_8_amount, koufu_amount")
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
  let lines = linesRes.data;
  if (linesRes.error) {
    // cost_kind/tax 列が未適用(026前)のとき従来列のみで再取得
    const { data } = await admin
      .from("statement_lines")
      .select("id, amount, self_pay_amount, service_name, quantity")
      .eq("payment_id", payment.id);
    lines = data as typeof lines;
  }

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

  // B案: レセプト由来のサービス明細(区分02)があれば、明細書を単位ベースに差し替える。
  // テーブル未適用や明細無しのときは A案(statement_lines金額ベース)のまま。
  const lineIds = (lines ?? []).map((l) => (l as { id: string }).id).filter(Boolean);
  if (lineIds.length > 0) {
    try {
      const { data: details } = await admin
        .from("statement_service_details")
        .select("service_type_code, service_item_code, unit_score, count, total_units, amount, sort_order")
        .in("statement_line_id", lineIds)
        .order("sort_order", { ascending: true });
      if (details && details.length > 0) {
        const rows = details as Array<Record<string, unknown>>;
        // 医療UKE(amount>0・単位数0) と 介護(単位数ベース) を明細データから自動判別
        const isIryou = rows.some((d) => ((d.amount as number) ?? 0) > 0 && ((d.total_units as number) ?? 0) === 0);
        // カテゴリ未確定(?type・加盟店区分なし)で医療明細なら医療として表示
        if (isIryou && !category) input.category = "iryou";
        input.detailLines = isIryou
          ? buildIryouDetailLines(
              rows.map((d) => ({
                code: (d.service_item_code as string) ?? "",
                totalAmount: (d.amount as number) ?? 0,
                count: (d.count as number) ?? 0,
              }))
            )
          : buildKaigoDetailLines(
              rows.map((d) => ({
                serviceTypeCode: (d.service_type_code as string) ?? "",
                serviceItemCode: (d.service_item_code as string) ?? "",
                unitScore: (d.unit_score as number) ?? 0,
                count: (d.count as number) ?? 0,
                totalUnits: (d.total_units as number) ?? 0,
              }))
            );
      }
    } catch {
      // 明細テーブル未適用などは無視（A案のまま）
    }
  }

  let pdf: Uint8Array;
  try {
    pdf = await generateReceiptPdf(input);
  } catch (e) {
    const message = e instanceof Error ? e.message : "PDF生成に失敗しました";
    return NextResponse.json(apiError(`領収書PDFの生成に失敗しました: ${message}`, "PDF_ERROR"), { status: 500 });
  }

  // Storage へ保存し receipts に記録（永続化）。失敗しても配信は継続する。
  try {
    const periodIso = payment.captured_at ?? payment.created_at;
    const { start, end } = monthRange(periodIso);
    const path = storagePath(periodIso, payment.id);
    await uploadReceiptPdf(pdf, path, true); // 既存があれば上書き
    if (existing?.id) {
      await admin
        .from("receipts")
        .update({ pdf_path: path, issued_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await admin.from("receipts").insert({
        payment_id: payment.id,
        resident_id: payment.resident_id,
        period_start: start,
        period_end: end,
        pdf_path: path,
        issued_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    // 永続化に失敗してもPDF配信は行う（バケット未作成時など）。
    console.error("[receipts] 永続化に失敗しました:", e);
  }

  return pdfResponse(pdf, payment.id);
}

/** 領収書PDFのHTTPレスポンスを組み立てる */
function pdfResponse(pdf: Uint8Array, paymentId: string): NextResponse {
  return new NextResponse(pdf as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${paymentId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** ISO日時の属する月の初日・末日（YYYY-MM-DD）を返す（TZ非依存・先頭10文字基準） */
function monthRange(iso: string): { start: string; end: string } {
  const [y, m] = iso.slice(0, 10).split("-").map((s) => Number(s));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // m は1始まり→当月末日
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Storage 保存パス receipts/{YYYY}/{MM}/{paymentId}.pdf */
function storagePath(iso: string, paymentId: string): string {
  const [y, m] = iso.slice(0, 10).split("-");
  return `${y}/${m}/${paymentId}.pdf`;
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
