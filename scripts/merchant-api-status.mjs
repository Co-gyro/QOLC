/**
 * 加盟店向け決済API の取引・通知・異常ログを1日分表示する運用スクリプト（読み取り専用）
 *
 * 本番切替当日の監視や、加盟店からの問い合わせ時の確認に使う。DB への書き込みは行わない。
 *
 * 実行（リポジトリのルートで。.env.local の Supabase 接続情報を使う）:
 *   node scripts/merchant-api-status.mjs mch_live_XXXXXXXXXXXXXXXX            … 今日（JST）
 *   node scripts/merchant-api-status.mjs mch_test_XXXXXXXXXXXXXXXX 2026-10-02 … 指定日
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: "Bearer " + K };
/** PostgREST の GET */
const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json();
/** ISO 日時を JST の "MM-DD HH:mm:ss" に */
const jst = (iso) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(5, 19).replace("T", " ") : "-");

const [mid, day] = process.argv.slice(2);
if (!mid) throw new Error("api_merchant_id を指定してください");
const d = day ?? new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const from = new Date(`${d}T00:00:00+09:00`).toISOString(), to = new Date(new Date(from).getTime() + 86400e3).toISOString();

const [cred] = await get(`merchant_api_credentials?api_merchant_id=eq.${mid}&select=id,environment,revoked_at,suspended_at`);
if (!cred) throw new Error("資格情報が見つかりません");
console.log(`■ ${mid}（${cred.environment}${cred.revoked_at ? "・失効" : ""}${cred.suspended_at ? "・停止中" : ""}）${d} JST`);
const ps = await get(`merchant_payments?credential_id=eq.${cred.id}&created_at=gte.${from}&created_at=lt.${to}&select=id,order_id,payment_id,status,amount,usen_jutyu_cd,usen_status,card_brand,card_last4,failure_code,created_at,captured_at,refunded_at,closed_at&order=created_at.asc`);
console.log(`取引 ${ps.length}件`);
for (const p of ps)
  console.log(`  ${jst(p.created_at)} ${p.order_id} ${p.payment_id} ${p.status.padEnd(9)} ${String(p.amount).padStart(6)}円 ${p.usen_jutyu_cd} usen=${p.usen_status ?? "-"} ${p.card_brand ?? ""}${p.card_last4 ? "*" + p.card_last4 : ""} ${p.failure_code ?? ""} 売上=${jst(p.captured_at)} 返金=${jst(p.refunded_at)}`);
if (ps.length) {
  const wh = await get(`merchant_webhook_deliveries?merchant_payment_id=in.(${ps.map((p) => p.id).join(",")})&select=merchant_payment_id,event_type,attempt,status_code,error_message,occurred_at,delivered_at,next_retry_at&order=occurred_at.asc`);
  console.log(`通知 ${wh.length}件`);
  for (const w of wh) {
    const p = ps.find((x) => x.id === w.merchant_payment_id);
    const state = w.delivered_at ? `配送済 ${jst(w.delivered_at)}` : w.next_retry_at ? `再送待ち ${jst(w.next_retry_at)}` : "打ち切り";
    console.log(`  ${p.payment_id} ${w.event_type.padEnd(17)} 発生=${jst(w.occurred_at)} 応答=${w.status_code ?? "-"} 試行=${w.attempt} ${state} ${w.error_message ?? ""}`);
  }
  const logs = await get(`payment_audit_logs?request_body->>merchant_payment_id=in.(${ps.map((p) => p.id).join(",")})&action=in.(merchant_payment_error,merchant_amount_mismatch,merchant_reconcile_error,merchant_expire_error)&select=action,request_body,response_body,created_at`);
  if (logs.length) {
    console.log(`⚠ 異常ログ ${logs.length}件`);
    for (const l of logs) console.log(`  ${jst(l.created_at)} ${l.action} ${JSON.stringify(l.request_body).slice(0, 120)} ${JSON.stringify(l.response_body).slice(0, 160)}`);
  }
}
const sig = await get(`payment_audit_logs?action=eq.merchant_signature_invalid&request_body->>api_merchant_id=eq.${mid}&created_at=gte.${from}&created_at=lt.${to}&select=request_body,created_at`);
if (sig.length) {
  console.log(`⚠ 署名エラー ${sig.length}件`);
  for (const s of sig) console.log(`  ${jst(s.created_at)} ${s.request_body.reason} ${s.request_body.method} ${s.request_body.path}`);
}
