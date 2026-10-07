/**
 * GET  /api/wallet/declarations?date=YYYY-MM-DD           指定日（日本時間）の記録（新しい順）
 * GET  /api/wallet/declarations?from=YYYY-MM-DD&to=…       期間の記録（施設ポータル。最大93日）
 * POST /api/wallet/declarations                   入居者1人を指定して記録を作る（status=selecting）
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/audit/activity-log";
import { authorizeWalletStaff, walletError } from "@/lib/wallet/auth";
import { DECLARATION_SELECT, type DeclarationRow, jstDayRange, toDto, toDtos } from "@/lib/wallet/declarations";
import { activeCardId } from "@/lib/wallet/transition";
import { apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.union([
  z.object({ date: day }),
  z.object({ from: day, to: day }).refine(
    (q) => q.from <= q.to && Date.parse(q.to) - Date.parse(q.from) <= 92 * 86_400_000,
  ),
]);
const createSchema = z.object({
  resident_id: z.string().uuid(),
  payment_method: z.enum(["apple_pay", "physical_card"]).default("apple_pay"),
});

/** 指定日の記録 */
export async function GET(req: NextRequest) {
  const staff = await authorizeWalletStaff(req);
  if ("response" in staff) return staff.response;
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const query = querySchema.safeParse(params);
  if (!query.success) return walletError("日付を YYYY-MM-DD で指定してください", "VALIDATION", 400).response;

  const from = jstDayRange("date" in query.data ? query.data.date : query.data.from).from;
  const to = jstDayRange("date" in query.data ? query.data.date : query.data.to).to;
  const { data, error } = await staff.admin
    .from("purchase_declarations")
    .select(DECLARATION_SELECT)
    .eq("facility_id", staff.facilityId)
    .gte("selected_at", from)
    .lt("selected_at", to)
    .is("deleted_at", null)
    .order("selected_at", { ascending: false });
  if (error) return walletError("記録を読み込めませんでした", "DB_ERROR", 500).response;
  return NextResponse.json(apiOk({ declarations: await toDtos(staff.admin, (data ?? []) as unknown as DeclarationRow[]) }));
}

/** 記録を作る */
export async function POST(req: NextRequest) {
  const staff = await authorizeWalletStaff(req);
  if ("response" in staff) return staff.response;
  const body = createSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return walletError("入力が正しくありません", "VALIDATION", 400).response;

  const { data: resident } = await staff.admin
    .from("residents")
    .select("id, name_last, name_first")
    .eq("id", body.data.resident_id)
    .eq("facility_id", staff.facilityId)
    .eq("wallet_enabled", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!resident) return walletError("入居者が見つかりません", "NOT_FOUND", 404).response;

  const { data, error } = await staff.admin
    .from("purchase_declarations")
    .insert({
      facility_id: staff.facilityId,
      resident_id: resident.id,
      staff_user_id: staff.userId,
      card_id: await activeCardId(staff),
      payment_method: body.data.payment_method,
      status: "selecting",
    })
    .select(DECLARATION_SELECT)
    .single();
  if (error || !data) return walletError("記録を作れませんでした", "DB_ERROR", 500).response;

  const row = data as unknown as DeclarationRow;
  await logActivity({
    actorId: staff.userId,
    facilityId: staff.facilityId,
    action: "wallet_declaration_create",
    targetType: "purchase_declaration",
    targetId: row.id,
    targetLabel: `${resident.name_last} ${resident.name_first}`,
  });
  return NextResponse.json(apiOk({ declaration: toDto(row) }), { status: 201 });
}
