/**
 * Selfish 登録データの材料を DB から集める（server-only・admin client）
 *
 * 加盟店（merchants）+ 元申請（applications: merchant_id で紐付く最新の qolc_merchant）
 * から buildSelfishPayload の入力を組み立てる。最後の送信記録（application_events
 * kind=selfish_registered）も返し、画面で「登録済み」を示す。
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseUdInput } from "@/lib/applications/ud-input";
import { pickMerchantApplyPayload } from "@/lib/applications/convert";
import { buildSelfishPayload, type SelfishBuildResult } from "./build-payload";

/** 送信記録の要約 */
export interface SelfishLastRegistration {
  at: string;
  result: string;
  request_id: string | null;
}

/** 読み込み結果 */
export interface SelfishSourceLoad {
  merchantName: string;
  applicationId: string | null;
  build: SelfishBuildResult;
  last: SelfishLastRegistration | null;
}

/** イベント detail から送信記録を読む（形式不正は null） */
function readRegistration(row: { created_at: string; detail: unknown }): SelfishLastRegistration {
  const d = (row.detail ?? {}) as Record<string, unknown>;
  return {
    at: row.created_at,
    result: typeof d.result === "string" ? d.result : "unknown",
    request_id: typeof d.request_id === "string" ? d.request_id : null,
  };
}

/**
 * 加盟店 ID から Selfish 登録データを組み立てる。
 * @returns 加盟店が存在しない（論理削除含む）場合は null
 */
export async function loadSelfishSource(merchantId: string): Promise<SelfishSourceLoad | null> {
  const admin = getSupabaseAdminClient();
  const { data: merchant, error: mErr } = await admin
    .from("merchants")
    .select("id, name, jcb_merchant_code_recurring, jcb_merchant_code_ec, saison_merchant_code")
    .eq("id", merchantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (mErr) throw new Error(`加盟店の取得に失敗しました: ${mErr.message}`);
  if (!merchant) return null;
  const m = merchant as {
    id: string;
    name: string;
    jcb_merchant_code_recurring: string | null;
    jcb_merchant_code_ec: string | null;
    saison_merchant_code: string | null;
  };

  // 元申請（最新1件）。紐付きがなければ口座・料率は空のまま組み立てる
  const { data: app, error: aErr } = await admin
    .from("applications")
    .select("id, payload, ud_input")
    .eq("merchant_id", merchantId)
    .eq("source", "qolc_merchant")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aErr) throw new Error(`元申請の取得に失敗しました: ${aErr.message}`);
  const application = app as {
    id: string;
    payload: Record<string, unknown> | null;
    ud_input: Record<string, unknown> | null;
  } | null;

  const payloadRaw = (application?.payload ?? {}) as Record<string, unknown>;
  const picked = pickMerchantApplyPayload(payloadRaw);
  const contactEmail =
    typeof payloadRaw.contactEmail === "string" ? payloadRaw.contactEmail.trim() : undefined;
  const { fields } = parseUdInput(application?.ud_input ?? null);

  const build = buildSelfishPayload({
    merchant: {
      id: m.id,
      name: m.name,
      jcbMerchantCodeRecurring: m.jcb_merchant_code_recurring,
      jcbMerchantCodeEc: m.jcb_merchant_code_ec,
      saisonMerchantCode: m.saison_merchant_code,
    },
    applyPayload: { corpName: picked.corpName, facilityName: picked.facilityName, contactEmail },
    ud: fields,
    applicationId: application?.id ?? null,
  });

  let last: SelfishLastRegistration | null = null;
  if (application) {
    const { data: ev } = await admin
      .from("application_events")
      .select("created_at, detail")
      .eq("application_id", application.id)
      .eq("kind", "selfish_registered")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ev) last = readRegistration(ev as { created_at: string; detail: unknown });
  }

  return { merchantName: m.name, applicationId: application?.id ?? null, build, last };
}
