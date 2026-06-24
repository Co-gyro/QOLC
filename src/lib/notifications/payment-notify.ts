/**
 * 決済イベントの通知（サーバー専用）。
 *
 * バッチ決済の完了後に、売上計上（captured）された各決済について
 * 入居者の家族・本人へ「お支払い完了」通知を送る。
 * 通知は記録 + LINE push（対象者のみ）。失敗は本処理に影響させない。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyResidentAccount, notifyResident } from "./notify";

/** 金額を「1,200円」形式へ整形する。 */
export function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

/** 決済完了通知の本文を組み立てる（純粋関数）。 */
export function buildPaymentCompletedMessage(amount: number, merchantName?: string | null): {
  title: string;
  body: string;
} {
  const lines = [`ご利用金額: ${formatYen(amount)}`];
  if (merchantName) lines.push(`ご利用先: ${merchantName}`);
  lines.push("詳細はQOLCマイページからご確認いただけます。");
  return { title: "お支払いが完了しました", body: lines.join("\n") };
}

/**
 * 指定バッチで captured（売上計上済み）になった決済について通知する。
 * resident_account_id が判明していればその宛先へ、なければ入居者の全アカウントへ送る。
 */
export async function notifyCapturedPaymentsForBatch(
  admin: SupabaseClient,
  uploadBatchId: string
): Promise<void> {
  const { data: payments } = await admin
    .from("payments")
    .select("id, resident_id, resident_account_id, total_amount, merchants(name)")
    .eq("upload_batch_id", uploadBatchId)
    .eq("payment_status", "captured");
  if (!payments || payments.length === 0) return;

  for (const p of payments) {
    const merchant = p.merchants as unknown as { name: string | null } | null;
    const { title, body } = buildPaymentCompletedMessage(
      Number(p.total_amount),
      merchant?.name ?? null
    );

    if (p.resident_account_id) {
      await notifyResidentAccount(admin, {
        residentAccountId: p.resident_account_id as string,
        type: "payment_completed",
        title,
        body,
      });
    } else {
      await notifyResident(admin, p.resident_id as string, {
        type: "payment_completed",
        title,
        body,
      });
    }
  }
}
