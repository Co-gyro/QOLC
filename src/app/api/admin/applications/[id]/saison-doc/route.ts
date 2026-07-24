/**
 * GET /api/admin/applications/[id]/saison-doc
 *
 * セゾン加盟店申請（審査FMT）のExcelを生成して返す（admin 専用）。
 * templates/saison-shinsa-fmt.xlsx（セゾン提供様式・マクロなし可）に
 * 申請データを転記した1行を書き込む。不足項目があれば 400 で理由を返す。
 * 提出はクリプト便（ダウンロード後の運用は画面側に明記）。
 */
import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import ExcelJS from "exceljs";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import { apiError } from "@/types/api";
import {
  buildSaisonRow,
  fillSaisonWorkbook,
  buildSaisonFilename,
} from "@/lib/merchant-application/saison-doc";
import { getJstDateParts } from "@/lib/workflow/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: app, error } = await admin
    .from("applications")
    .select("id, source, payload, ud_input, applicant_org")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    return NextResponse.json(apiError(`取得に失敗しました: ${error.message}`, "DB"), {
      status: 500,
    });
  }
  if (!app) {
    return NextResponse.json(apiError("申請が見つかりません", "NOT_FOUND"), { status: 404 });
  }
  const application = app as {
    source: string;
    payload: Record<string, unknown> | null;
    ud_input: Record<string, unknown> | null;
    applicant_org: string | null;
  };
  if (application.source !== "qolc_merchant") {
    return NextResponse.json(
      apiError("セゾン申請書は加盟店申請の案件のみ生成できます", "BAD_REQUEST"),
      { status: 400 }
    );
  }

  const { values, errors } = buildSaisonRow(application.payload, application.ud_input);
  if (errors.length > 0) {
    return NextResponse.json(apiError(errors.join(" / "), "VALIDATION_ERROR"), { status: 400 });
  }

  // テンプレートをロードして転記（outputFileTracingIncludes で同梱される）
  const templatePath = path.join(process.cwd(), "templates", "saison-shinsa-fmt.xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  fillSaisonWorkbook(wb, values);
  const buffer = await wb.xlsx.writeBuffer();

  const payload = application.payload ?? {};
  const name =
    (typeof payload.facilityName === "string" && payload.facilityName) ||
    application.applicant_org ||
    "加盟店";
  const filename = buildSaisonFilename(name, getJstDateParts());

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="saison.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
