/**
 * POST /api/wallet/auto-records
 * 支払いの自動記録の受信（iPhone のショートカットの自動化から、ウォレットで支払った直後に送られる）。
 * 認証は端末ごとの鍵（Authorization: Bearer <端末の鍵>）。Supabase のログインは使わない。
 */
import { NextResponse, type NextRequest } from "next/server";
import { logActivity } from "@/lib/audit/activity-log";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { bearerToken, walletError } from "@/lib/wallet/auth";
import { autoRecordPayloadSchema, hashDeviceKey, linkAutoRecord, normalizeAutoRecord } from "@/lib/wallet/auto-record";
import { apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

/** 自動記録を受け取る */
export async function POST(req: NextRequest) {
  const key = bearerToken(req);
  if (!key || key.length < 24) return walletError("端末の鍵がありません", "UNAUTHORIZED", 401).response;

  const admin = getSupabaseAdminClient();
  const { data: device } = await admin.from("devices")
    .select("id, facility_id, name")
    .eq("auto_record_key_hash", hashDeviceKey(key))
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (!device) return walletError("端末の鍵が正しくありません", "UNAUTHORIZED", 401).response;

  const raw = await req.json().catch(() => null);
  const payload = autoRecordPayloadSchema.safeParse(raw ?? {});
  if (!payload.success) return walletError("内容が正しくありません", "VALIDATION", 400).response;

  const receivedAt = new Date().toISOString();
  const since = new Date(Date.parse(receivedAt) - 2 * 3_600_000).toISOString();
  const { data: recent } = await admin.from("purchase_declarations")
    .select("id, status, selected_at, paid_at")
    .eq("facility_id", device.facility_id)
    .gte("selected_at", since)
    .is("deleted_at", null);
  const declarationId = linkAutoRecord(receivedAt, (recent ?? []).map((d) => ({
    id: d.id as string, status: d.status as string, selectedAt: d.selected_at as string, paidAt: (d.paid_at as string | null) ?? null,
  })));

  const values = normalizeAutoRecord(payload.data);
  const { data: record, error } = await admin.from("wallet_auto_records").insert({
    facility_id: device.facility_id,
    device_id: device.id,
    received_at: receivedAt,
    ...values,
    raw: payload.data,
    declaration_id: declarationId,
    link_status: declarationId ? "linked" : "unlinked",
  }).select("id, link_status").single();
  if (error || !record) return walletError("記録できませんでした", "DB_ERROR", 500).response;

  if (declarationId) {
    await admin.from("purchase_declarations")
      .update({ auto_amount: values.amount, auto_merchant_name: values.merchant_name })
      .eq("id", declarationId);
  }
  await logActivity({
    facilityId: device.facility_id as string,
    action: declarationId ? "wallet_auto_record_linked" : "wallet_auto_record_unlinked",
    targetType: "wallet_auto_record",
    targetId: record.id as string,
    targetLabel: values.merchant_name,
    metadata: { device: device.name, amount: values.amount, declaration_id: declarationId },
  });
  // TODO(W1): 結びつかない支払い（記録のない支払い）を責任者へ LINE・メールで即時通知する
  return NextResponse.json(apiOk({ id: record.id, linked: Boolean(declarationId) }), { status: 201 });
}
