/**
 * 登録済みカードのブランド・下4桁・有効期限を USEN の会員情報取得（/member/get・読み取りのみ）で埋める。
 * 対象: QOLC の支払いオーナー（resident_accounts）と UD Payment の顧客（udpay_customers）のうち、
 *       会員IDがあって有効期限が未取得のもの。migration 042 の適用後に1回実行する。
 *
 * 実行: ALLOW_USEN_PROD=1 npx tsx --env-file=.env.local scripts/backfill-card-expiry.ts [--dry-run]
 *   --dry-run は取得結果を表示するだけで保存しない。
 */
import { getSupabaseAdminClient } from "../src/lib/supabase/admin";
import { memberGet } from "../src/lib/payment/member-api";
import { extractMemberCard } from "../src/lib/udpay/prod/card-registration";

async function main() {
  const dry = process.argv.includes("--dry-run");
  const client = getSupabaseAdminClient();
  const targets: { table: "resident_accounts" | "udpay_customers"; id: string; memberId: string }[] = [];
  for (const table of ["resident_accounts", "udpay_customers"] as const) {
    const { data, error } = await client
      .from(table)
      .select("id, usen_member_id")
      .not("usen_member_id", "is", null)
      .is("card_expire_ym", null)
      .is("deleted_at", null);
    if (error) {
      console.error(`${table}: 取得できません（migration 042 未適用？）: ${error.message}`);
      continue;
    }
    for (const r of (data ?? []) as { id: string; usen_member_id: string }[]) targets.push({ table, id: r.id, memberId: r.usen_member_id });
  }
  console.log(`対象 ${targets.length}件${dry ? "（dry-run）" : ""}`);
  let saved = 0;
  for (const t of targets) {
    const res = await memberGet({ memberId: t.memberId }, { performedBy: null });
    if (res.result !== "ok") {
      console.log(`- ${t.table} ${t.id}: 会員情報を取得できません（code=${res.code}）`);
      continue;
    }
    const card = extractMemberCard(res);
    console.log(`- ${t.table} ${t.id}: ${card.brand ?? "?"} 下4桁 ${card.last4 ?? "?"} 期限 ${card.expireYm ?? "?"}`);
    if (dry || !card.expireYm) continue;
    const { error } = await client
      .from(t.table)
      .update({ card_brand: card.brand, card_last4: card.last4, card_expire_ym: card.expireYm, card_checked_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) console.log(`  保存に失敗: ${error.message}`);
    else saved++;
  }
  console.log(`保存 ${saved}件`);
}
void main();
