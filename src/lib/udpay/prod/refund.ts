import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberApiResult } from "@/lib/payment/types";

/**
 * UD Payment（本番）の取消・返品（全額）。UD の管理画面から行う。
 *
 * - 課金した当日（売上日＝今日）: 売上取消（/sales/salescancel）→ 与信取消（/auth/void）。
 *   売上取消だけでは取引が「与信」に戻るだけで利用枠の確保が残るため、与信取消まで行う
 *   （2026-10-14 本番疎通で確認）。利用明細には載らない。
 * - 翌日以降（または当日でも締め後に売上取消が code=41 で拒否された場合）: 返品（/sales/salesreturn）。
 *   sales_day は元の売上日と一致させる。利用明細には請求と返金の両方が載る。
 * 一部返金は扱わない（翌月請求のマイナス明細で相殺する運用）。
 */

/** 外部依存（テストで差し替える） */
export interface RefundDeps {
  client: SupabaseClient;
  salesCancel: (args: { jutyuCd: string; amount: number; salesDay: string }) => Promise<MemberApiResult>;
  authVoid: (args: { jutyuCd: string; amount: number; jutyuDay: string }) => Promise<MemberApiResult>;
  salesReturn: (args: { jutyuCd: string; amount: number; salesDay: string }) => Promise<MemberApiResult>;
  now: () => Date;
}

/** 取消・返品の種類 */
export type RefundKind = "cancel" | "return";

/** ISO 日時の日本時間の日付（YYYY-MM-DD） */
export function jstDateOf(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** USEN の日付表記（YYYY/MM/DD） */
function usenDate(ymd: string): string {
  return ymd.replace(/-/g, "/");
}

/** 売上日（日本時間）と今日から、取消か返品かを決める */
export function refundKindFor(capturedAtIso: string, now: Date): RefundKind {
  return jstDateOf(capturedAtIso) === jstDateOf(now.toISOString()) ? "cancel" : "return";
}

/** 取消・返品の結果 */
export type RefundResult =
  | { ok: true; kind: RefundKind }
  | { ok: false; error: string };

/**
 * 入金済み（captured）の課金を全額取消・返品する。
 * 二重実行を防ぐため、captured → processing の条件付き UPDATE を先に取り、終わったら
 * 取消は cancelled、返品は refunded にする（失敗時は captured に戻す）。
 */
export async function refundPayment(deps: RefundDeps, paymentId: string): Promise<RefundResult> {
  const { client } = deps;
  const { data } = await client
    .from("udpay_payments")
    .select("id, status, amount, usen_jutyu_cd, captured_at")
    .eq("id", paymentId)
    .maybeSingle();
  const p = data as { id: string; status: string; amount: number; usen_jutyu_cd: string | null; captured_at: string | null } | null;
  if (!p) return { ok: false, error: "決済が見つかりません" };
  if (p.status !== "captured" || !p.usen_jutyu_cd || !p.captured_at) {
    return { ok: false, error: "入金済みの決済だけ取消・返品できます" };
  }
  const lock = await client
    .from("udpay_payments")
    .update({ status: "processing" })
    .eq("id", p.id)
    .eq("status", "captured")
    .select("id");
  if (lock.error || !lock.data?.length) return { ok: false, error: "他の操作と重なりました。画面を更新してください" };

  const now = deps.now();
  const amount = Number(p.amount);
  const jutyuCd = p.usen_jutyu_cd;
  const salesDay = usenDate(jstDateOf(p.captured_at));
  const restore = () => client.from("udpay_payments").update({ status: "captured" }).eq("id", p.id);

  try {
    if (refundKindFor(p.captured_at, now) === "cancel") {
      const c = await deps.salesCancel({ jutyuCd, amount, salesDay });
      if (c.result === "ok") {
        const v = await deps.authVoid({ jutyuCd, amount, jutyuDay: usenDate(jstDateOf(now.toISOString())) });
        if (v.result !== "ok") {
          // 売上は取り消せた。与信は数日で自動失効するため、取消として扱い記録に残す
          await client
            .from("udpay_payments")
            .update({ status: "cancelled", cancelled_at: now.toISOString(), last_error_code: `VOID_${v.code ?? "NG"}`, last_error_message: "与信取消は失敗（自動失効待ち）" })
            .eq("id", p.id);
          return { ok: true, kind: "cancel" };
        }
        await client.from("udpay_payments").update({ status: "cancelled", cancelled_at: now.toISOString() }).eq("id", p.id);
        return { ok: true, kind: "cancel" };
      }
      // 締め後（code=41）は返品に切り替える。それ以外の失敗は元に戻す
      if (c.code !== "41") {
        await restore();
        return { ok: false, error: `取消できませんでした（code=${c.code ?? "?"}）` };
      }
    }
    const r = await deps.salesReturn({ jutyuCd, amount, salesDay });
    if (r.result !== "ok") {
      await restore();
      return { ok: false, error: `返品できませんでした（code=${r.code ?? "?"}）` };
    }
    await client.from("udpay_payments").update({ status: "refunded", refunded_at: now.toISOString() }).eq("id", p.id);
    return { ok: true, kind: "return" };
  } catch (e) {
    // 通信断などで結果が分からない場合は processing のまま残し、取引照会で確認する
    return { ok: false, error: `結果を確認できませんでした（取引照会で確認してください）: ${e instanceof Error ? e.message : "unknown"}` };
  }
}
