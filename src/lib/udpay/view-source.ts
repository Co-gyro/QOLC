import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UdpayStore } from "./types";
import type { UdpayMode } from "./mode";
import { loadStore } from "./store";
import { getBillingMember, type BillingMember } from "./prod/member";
import { loadBillingStore } from "./prod/snapshot";

/** 画面が読むデータ（デモ: デモ用ストア／本番: ログイン利用者の加盟店分） */
export type ViewData =
  | { ok: true; store: UdpayStore; member: BillingMember | null }
  | { ok: false; reason: "no_member" };

/** モードに応じて画面のデータを読み込む */
export async function loadView(mode: UdpayMode): Promise<ViewData> {
  if (mode === "demo") return { ok: true, store: await loadStore(), member: null };
  const member = await getBillingMember();
  if (!member) return { ok: false, reason: "no_member" };
  return { ok: true, store: await loadBillingStore(getSupabaseAdminClient(), member.merchantId), member };
}
