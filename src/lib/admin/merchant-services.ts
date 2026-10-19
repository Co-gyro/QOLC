import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * 加盟店の契約・ライセンス（merchant_services・migration 041）。
 * 1加盟店につきサービスごとに1契約。状態・プラン名・利用人数の上限を持ち、利用中の人数は実際のアカウントから数える。
 */

/** サービスの種類 */
export const SERVICE_KINDS = ["udpay", "merchant_api", "qolc", "store_terminal"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

/** 契約の状態 */
export const SERVICE_STATUSES = ["preparing", "active", "suspended", "terminated"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const SERVICE_LABEL: Record<ServiceKind, string> = {
  udpay: "UD Payment（請求・カード決済）",
  merchant_api: "加盟店API（決済画面の提供）",
  qolc: "QOLC（介護施設向け）",
  store_terminal: "店頭決済",
};

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  preparing: "準備中",
  active: "稼働中",
  suspended: "一時停止",
  terminated: "解約",
};

/** 契約1件（利用中の人数つき） */
export interface MerchantService {
  id: string;
  service: ServiceKind;
  status: ServiceStatus;
  planName: string | null;
  seatLimit: number | null;
  /** 利用中の人数（停止・削除されていないアカウント数。人数で数えないサービスは null） */
  seatsUsed: number | null;
  startedOn: string | null;
  endedOn: string | null;
  notes: string | null;
  updatedAt: string;
}

/** 契約の入力 */
export const serviceInputSchema = z.object({
  service: z.enum(SERVICE_KINDS),
  status: z.enum(SERVICE_STATUSES),
  planName: z.string().trim().max(100).optional().nullable(),
  seatLimit: z.number().int().min(0).max(10000).optional().nullable(),
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
  endedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
  notes: z.string().max(2000).optional().nullable(),
});
export type ServiceInput = z.infer<typeof serviceInputSchema>;

/** テーブルがまだない（migration 041 未適用）ことを示すエラーか */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /merchant_services/.test(error.message ?? "")));
}

/** サービスごとの利用中の人数（UD Payment=利用者、QOLC=提供者アカウント。それ以外は数えない） */
export async function countSeats(client: SupabaseClient, merchantId: string, service: ServiceKind): Promise<number | null> {
  if (service === "udpay") {
    const { count } = await client.from("udpay_members").select("user_id", { count: "exact", head: true }).eq("merchant_id", merchantId).is("deleted_at", null);
    return count ?? 0;
  }
  if (service === "qolc") {
    const { count } = await client.from("profiles").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId).eq("role", "provider").is("deleted_at", null);
    return count ?? 0;
  }
  return null;
}

/** 加盟店の契約一覧。テーブル未作成なら ready=false */
export async function listMerchantServices(client: SupabaseClient, merchantId: string): Promise<{ ready: boolean; services: MerchantService[] }> {
  const { data, error } = await client
    .from("merchant_services")
    .select("id, service, status, plan_name, seat_limit, started_on, ended_on, notes, updated_at")
    .eq("merchant_id", merchantId)
    .is("deleted_at", null);
  if (isMissingTable(error)) return { ready: false, services: [] };
  if (error) throw new Error(`契約の取得に失敗: ${error.message}`);
  const rows = (data ?? []) as {
    id: string; service: ServiceKind; status: ServiceStatus; plan_name: string | null; seat_limit: number | null;
    started_on: string | null; ended_on: string | null; notes: string | null; updated_at: string;
  }[];
  const services: MerchantService[] = [];
  for (const r of rows.sort((a, b) => SERVICE_KINDS.indexOf(a.service) - SERVICE_KINDS.indexOf(b.service))) {
    services.push({
      id: r.id,
      service: r.service,
      status: r.status,
      planName: r.plan_name,
      seatLimit: r.seat_limit,
      seatsUsed: await countSeats(client, merchantId, r.service),
      startedOn: r.started_on,
      endedOn: r.ended_on,
      notes: r.notes,
      updatedAt: r.updated_at,
    });
  }
  return { ready: true, services };
}

/** 入力を DB 列にする（空文字は NULL） */
function toColumns(input: ServiceInput) {
  const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  return {
    status: input.status,
    plan_name: blank(input.planName),
    seat_limit: input.seatLimit ?? null,
    started_on: blank(input.startedOn),
    ended_on: blank(input.endedOn),
    notes: blank(input.notes),
  };
}

/** 契約を追加または更新する（同じサービスの契約があれば更新） */
export async function saveMerchantService(
  client: SupabaseClient,
  merchantId: string,
  input: ServiceInput,
  actorId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: findErr } = await client
    .from("merchant_services")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("service", input.service)
    .is("deleted_at", null)
    .maybeSingle();
  if (isMissingTable(findErr)) return { ok: false, error: "契約の記録用のテーブルがまだありません（migration 041 を適用してください）" };
  const cols = toColumns(input);
  const res = existing
    ? await client.from("merchant_services").update(cols).eq("id", existing.id as string)
    : await client.from("merchant_services").insert({ merchant_id: merchantId, service: input.service, created_by: actorId, ...cols });
  if (res.error) {
    if (res.error.code === "23514") return { ok: false, error: "終了日は開始日以降にしてください" };
    return { ok: false, error: `保存に失敗: ${res.error.message}` };
  }
  return { ok: true };
}

/**
 * アカウントを1人増やせるか（人数の上限チェック）。
 * 契約が無い・上限なし・テーブル未作成のときは制限しない。一時停止・解約中の契約では発行させない。
 */
export async function canAddSeat(client: SupabaseClient, merchantId: string, service: ServiceKind): Promise<{ ok: true } | { ok: false; error: string }> {
  const { ready, services } = await listMerchantServices(client, merchantId);
  if (!ready) return { ok: true };
  const s = services.find((x) => x.service === service);
  if (!s) return { ok: true };
  if (s.status === "suspended" || s.status === "terminated") {
    return { ok: false, error: `契約が「${STATUS_LABEL[s.status]}」のため、アカウントを発行できません` };
  }
  if (s.seatLimit !== null && (s.seatsUsed ?? 0) >= s.seatLimit) {
    return { ok: false, error: `利用人数の上限（${s.seatLimit}名）に達しています。契約・ライセンスで上限を変更してください` };
  }
  return { ok: true };
}

/** 加盟店一覧用: 全加盟店の契約（テーブル未作成なら空） */
export async function listAllMerchantServices(client: SupabaseClient): Promise<Map<string, { service: ServiceKind; status: ServiceStatus; planName: string | null }[]>> {
  const map = new Map<string, { service: ServiceKind; status: ServiceStatus; planName: string | null }[]>();
  const { data, error } = await client.from("merchant_services").select("merchant_id, service, status, plan_name").is("deleted_at", null);
  if (error) return map;
  for (const r of (data ?? []) as { merchant_id: string; service: ServiceKind; status: ServiceStatus; plan_name: string | null }[]) {
    const list = map.get(r.merchant_id) ?? [];
    list.push({ service: r.service, status: r.status, planName: r.plan_name });
    map.set(r.merchant_id, list);
  }
  return map;
}
