/**
 * 加盟店向け決済API の返金（全額）を実行する運用スクリプト（接続仕様書 第11章：返金は当社が実施）
 *
 * 既定は確認だけ（対象の決済と送信内容を表示）。--execute を付けたときだけ USEN へ返金を送る。
 * 返金に成功すると refunded に変わり、加盟店へ payment.refunded 通知が送られる（毎分の定期処理）。
 *
 * 実行（.env.local を使う。USEN のホストは本番・テスト共通のため ALLOW_USEN_PROD=1 が必要）:
 *   確認: ALLOW_USEN_PROD=1 npx tsx scripts/merchant-api-refund.ts --payment-id pay_XXXX --operator 小平
 *   実行: ALLOW_USEN_PROD=1 npx tsx scripts/merchant-api-refund.ts --payment-id pay_XXXX --operator 小平 --execute
 *
 * ⚠️ 本番（production）の決済は実際に購入者のカードへ返金される。対象を確認してから実行すること。
 */
import { readFileSync } from "node:fs";

/** .env.local を読み込んで process.env に足す（既存値は上書きしない） */
function loadEnvLocal(): void {
  let text = "";
  try {
    text = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

/** --key value 形式の引数を読む */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** エントリポイント */
async function main(): Promise<void> {
  loadEnvLocal();
  // 環境変数を読み込んでから依存を組み立てる
  const { createMerchantApiDeps } = await import("../src/lib/merchant-api/runtime");
  const { refundMerchantPayment } = await import("../src/lib/merchant-api/service-refund");
  const { usenDate } = await import("../src/lib/merchant-api/time");

  const paymentId = arg("payment-id");
  const operator = arg("operator");
  if (!paymentId || !/^pay_[0-9A-Z]{26}$/.test(paymentId)) throw new Error("--payment-id pay_… を指定してください");
  if (!operator) throw new Error("--operator（実施者名）を指定してください。監査ログに残ります");

  const deps = createMerchantApiDeps();
  const row = await deps.store.findPaymentByPaymentId(paymentId);
  if (!row) throw new Error(`決済が見つかりません: ${paymentId}`);
  const merchant = await deps.store.getMerchant(row.merchant_id);
  console.log("対象の決済");
  console.log(`  環境       : ${row.environment}${row.environment === "production" ? "  ⚠️ 本番（実際にカードへ返金されます）" : "（テストモール・実際の請求なし）"}`);
  console.log(`  加盟店     : ${merchant?.name ?? row.merchant_id}`);
  console.log(`  payment_id : ${row.payment_id}`);
  console.log(`  order_id   : ${row.order_id}`);
  console.log(`  状態       : ${row.status}`);
  console.log(`  金額       : ${Number(row.amount).toLocaleString("ja-JP")}円（全額を返金）`);
  console.log(`  受注コード : ${row.usen_jutyu_cd}`);
  console.log(`  売上計上日 : ${row.captured_at ? usenDate(new Date(row.captured_at)) : "-"}`);

  if (!process.argv.includes("--execute")) {
    console.log("\n確認のみで終了しました。返金するには --execute を付けて再実行してください。");
    return;
  }
  const res = await refundMerchantPayment(deps, paymentId, operator);
  console.log(`\n返金しました（USEN result=${res.usen.result} code=${res.usen.code} process_day=${res.usen.processDay ?? "-"}）`);
  console.log(`  状態: ${res.payment.status}  refunded_at: ${res.payment.refunded_at}`);
  console.log("  payment.refunded 通知は毎分の定期処理で加盟店へ送られます。");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
