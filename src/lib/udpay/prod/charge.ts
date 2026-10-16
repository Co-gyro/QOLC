import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberApiResult } from "@/lib/payment/types";

/**
 * UD Payment（本番）の課金（会員ID決済）。毎朝の自動処理（/api/cron/daily）と手動の再決済から呼ぶ。
 *
 * 1件ごとに: 先取りロック（scheduled|failed → processing の条件付き UPDATE。成立した1件だけ進む）
 * → 受注コード採番（加盟店のモールコード）→ 受注コードを保存 → 与信（authbymemberid）→ 売上計上（salesadd）
 * → captured。与信・売上計上の失敗は failed（与信落ち）。通信断などで結果が分からないものは
 * processing のまま残し、次回の自動処理で取引照会（/search/trade）して確定させる。
 */

/** 外部依存（テストで差し替える） */
export interface ChargeDeps {
  client: SupabaseClient;
  nextJutyuCd: (mallCode: string) => Promise<string>;
  /** 与信。失敗（result=ng）は例外 */
  authByMemberId: (args: { jutyuCd: string; amount: number; memberId: string }) => Promise<MemberApiResult>;
  /** 売上計上。失敗は例外 */
  salesAdd: (args: { jutyuCd: string; amount: number }) => Promise<MemberApiResult>;
  searchTrade: (args: { jutyuCd: string }) => Promise<MemberApiResult>;
  now: () => Date;
}

/** USEN の失敗（例外）から結果コードを取り出す */
function usenErrorCode(e: unknown): string | null {
  const code = (e as { errorCode?: unknown })?.errorCode;
  return typeof code === "string" ? code : null;
}

/** 課金1件の結果 */
export type ChargeOutcome = "captured" | "failed" | "skipped" | "unknown";

interface PaymentRow {
  id: string;
  invoice_id: string;
  customer_id: string;
  merchant_id: string;
  amount: number;
  status: string;
  attempt_count: number;
}

/** 課金を1件実行する（scheduled または failed のものだけ） */
export async function chargePayment(deps: ChargeDeps, paymentId: string): Promise<{ outcome: ChargeOutcome; error?: string }> {
  const { client } = deps;
  const { data: row } = await client
    .from("udpay_payments")
    .select("id, invoice_id, customer_id, merchant_id, amount, status, attempt_count")
    .eq("id", paymentId)
    .maybeSingle();
  const p = row as PaymentRow | null;
  if (!p || (p.status !== "scheduled" && p.status !== "failed")) return { outcome: "skipped" };

  // 先取りロック（同時に走っても1回だけ成立）
  const lock = await client
    .from("udpay_payments")
    .update({ status: "processing", attempt_count: p.attempt_count + 1 })
    .eq("id", p.id)
    .eq("status", p.status)
    .eq("attempt_count", p.attempt_count)
    .select("id");
  if (lock.error || !lock.data?.length) return { outcome: "skipped" };

  const fail = async (code: string | null, message: string): Promise<{ outcome: ChargeOutcome; error: string }> => {
    await client
      .from("udpay_payments")
      .update({ status: "failed", last_error_code: code, last_error_message: message })
      .eq("id", p.id);
    return { outcome: "failed", error: message };
  };

  // 決済確定の請求か・カード登録済みか（念のため課金直前にも確かめる）
  const [{ data: inv }, { data: cust }, { data: merchant }] = await Promise.all([
    client.from("udpay_invoices").select("status").eq("id", p.invoice_id).maybeSingle(),
    client.from("udpay_customers").select("usen_member_id").eq("id", p.customer_id).maybeSingle(),
    client.from("merchants").select("mall_code").eq("id", p.merchant_id).maybeSingle(),
  ]);
  if (inv?.status !== "approved") return fail("NOT_APPROVED", "決済確定されていない請求です");
  const memberId = cust?.usen_member_id as string | null;
  if (!memberId) return fail("NO_CARD", "カードが登録されていません");
  const mall = merchant?.mall_code as string | null;
  if (!mall) return fail("NO_MALL", "加盟店のモールコードが未設定です");

  const jutyuCd = await deps.nextJutyuCd(mall);
  await client.from("udpay_payments").update({ usen_jutyu_cd: jutyuCd }).eq("id", p.id);
  const amount = Number(p.amount);

  try {
    await deps.authByMemberId({ jutyuCd, amount, memberId });
  } catch (e) {
    const code = usenErrorCode(e);
    if (code) return fail(code, `カード会社の承認が得られませんでした（code=${code}）`);
    return { outcome: "unknown", error: e instanceof Error ? e.message : "与信の結果が不明です" };
  }
  await client.from("udpay_payments").update({ authorized_at: deps.now().toISOString() }).eq("id", p.id);
  try {
    await deps.salesAdd({ jutyuCd, amount });
  } catch (e) {
    const code = usenErrorCode(e);
    if (code) return fail(code, `売上計上に失敗しました（code=${code}）`);
    return { outcome: "unknown", error: e instanceof Error ? e.message : "売上計上の結果が不明です" };
  }
  await client
    .from("udpay_payments")
    .update({ status: "captured", captured_at: deps.now().toISOString(), last_error_code: null, last_error_message: null })
    .eq("id", p.id);
  return { outcome: "captured" };
}

/**
 * 結果が分からないまま processing に残った課金を、取引照会で確定させる。
 * 売上済み → captured／与信のみ → 売上計上して captured／それ以外 → failed。
 */
export async function recoverProcessing(deps: ChargeDeps, olderThanMinutes = 30): Promise<number> {
  const before = new Date(deps.now().getTime() - olderThanMinutes * 60_000).toISOString();
  const { data } = await deps.client
    .from("udpay_payments")
    .select("id, amount, usen_jutyu_cd")
    .eq("status", "processing")
    // 取消・返品の途中で止まったもの（captured_at あり）は対象外（UD が取引照会で確認する）
    .is("captured_at", null)
    .lt("updated_at", before);
  let recovered = 0;
  for (const p of (data ?? []) as { id: string; amount: number; usen_jutyu_cd: string | null }[]) {
    const update = (v: Record<string, unknown>) => deps.client.from("udpay_payments").update(v).eq("id", p.id).eq("status", "processing");
    if (!p.usen_jutyu_cd) {
      await update({ status: "failed", last_error_code: "UNKNOWN", last_error_message: "課金処理が途中で止まりました" });
      recovered++;
      continue;
    }
    const t = (await deps.searchTrade({ jutyuCd: p.usen_jutyu_cd })) as Record<string, string | undefined>;
    if (t.status === "sales" || t.status === "sales_reserve") {
      await update({ status: "captured", captured_at: deps.now().toISOString() });
    } else if (t.status === "auth" && t.auth_result === "ok") {
      try {
        await deps.salesAdd({ jutyuCd: p.usen_jutyu_cd, amount: Number(p.amount) });
        await update({ status: "captured", captured_at: deps.now().toISOString() });
      } catch (e) {
        await update({ status: "failed", last_error_code: usenErrorCode(e) ?? "UNKNOWN", last_error_message: "売上計上に失敗しました" });
      }
    } else {
      await update({ status: "failed", last_error_code: t.code ?? "UNKNOWN", last_error_message: "課金できませんでした（取引照会で確認）" });
    }
    recovered++;
  }
  return recovered;
}

/** 毎朝の自動課金: 課金日が今日以前の課金予定（決済確定済み）を順に課金する */
export async function runDueCharges(
  deps: ChargeDeps,
  today: string,
): Promise<{
  captured: number;
  failed: number;
  unknown: number;
  recovered: number;
  /** 1件ごとの結果（お知らせメールに使う） */
  details: { paymentId: string; outcome: ChargeOutcome; error?: string }[];
}> {
  const recovered = await recoverProcessing(deps);
  const { data } = await deps.client
    .from("udpay_payments")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_date", today)
    .order("scheduled_date");
  const result = { captured: 0, failed: 0, unknown: 0, recovered, details: [] as { paymentId: string; outcome: ChargeOutcome; error?: string }[] };
  for (const { id } of (data ?? []) as { id: string }[]) {
    const r = await chargePayment(deps, id);
    if (r.outcome !== "skipped") result.details.push({ paymentId: id, outcome: r.outcome, error: r.error });
    if (r.outcome === "captured") result.captured++;
    else if (r.outcome === "failed") result.failed++;
    else if (r.outcome === "unknown") result.unknown++;
  }
  return result;
}
