import { loadStore, saveStore } from "./store";

/**
 * UD Payment デモの課金処理（毎朝の自動課金・再決済）。外部決済には接続しない。
 */

/**
 * 自動課金を実行する（デモ: 課金日を待たず、決済確定済みの全件を課金する）。
 * 本番では毎朝、課金日が今日の決済確定分だけを課金する。
 * demoFailOnce フラグ付きの顧客は一度だけ与信落ち（do_not_honor）させる。
 */
export async function runChargeBatch(): Promise<{ paid: number; failed: number }> {
  const store = await loadStore();
  const now = new Date().toISOString();
  let paid = 0;
  let failed = 0;
  // 新しい課金日から処理する（デモの与信落ちを最新の請求で再現するため）
  const targets = store.payments
    .filter((p) => p.status === "scheduled")
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  for (const payment of targets) {
    const customer = store.customers.find((c) => c.id === payment.customerId);
    if (customer?.card.demoFailOnce) {
      customer.card.demoFailOnce = false;
      payment.status = "failed";
      payment.attempts.push({ at: now, result: "failed", reason: "do_not_honor" });
      failed++;
    } else {
      payment.status = "paid";
      payment.paidAt = now;
      payment.attempts.push({ at: now, result: "paid" });
      paid++;
    }
  }
  await saveStore(store);
  return { paid, failed };
}

/** 失敗した課金を再決済する（デモ: 再決済は成功する） */
export async function retryPayment(
  paymentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const store = await loadStore();
  const payment = store.payments.find((p) => p.id === paymentId);
  if (!payment) return { ok: false, error: "決済が見つかりません" };
  if (payment.status !== "failed") return { ok: false, error: "与信落ちの決済のみ再決済できます" };
  const now = new Date().toISOString();
  payment.status = "paid";
  payment.paidAt = now;
  payment.attempts.push({ at: now, result: "paid" });
  await saveStore(store);
  return { ok: true };
}
