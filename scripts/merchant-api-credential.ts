/**
 * 加盟店向け決済API の接続情報（merchant_id / 署名鍵）を発行・再発行する運用スクリプト
 *
 * 署名鍵は画面に一度だけ表示する（DB には暗号文のみ）。表示された値は加盟店へ
 * 安全な経路（パスワード付きファイル等）で渡し、手元のメモには残さないこと。
 *
 * 実行（.env.local の SUPABASE_SERVICE_ROLE_KEY と MERCHANT_API_SECRET_ENC_KEY を使う）:
 *   新規: npx tsx scripts/merchant-api-credential.ts issue --merchant <merchants.id> --env test \
 *           --domains ainylive.com,stg.ainylive.com --webhook https://stg.ainylive.com/api/ud/webhook
 *   再発行: npx tsx scripts/merchant-api-credential.ts rotate --api-merchant-id mch_test_XXXXXXXXXXXXXXXX
 *   一覧:   npx tsx scripts/merchant-api-credential.ts list --merchant <merchants.id>
 *
 * 本番の資格情報（--env production）は、本番の暗号鍵（Vercel の MERCHANT_API_SECRET_ENC_KEY）と
 * 同じ値をローカルに設定して実行すること。鍵が違うと本番で復号できず署名検証に失敗する。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildCredential, buildRotation } from "../src/lib/merchant-api/credentials";

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase の接続情報がありません");
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const command = process.argv[2];

  if (command === "issue") {
    const env = arg("env");
    if (env !== "test" && env !== "production") throw new Error("--env は test か production です");
    const issued = buildCredential({
      merchantId: arg("merchant") ?? "",
      environment: env,
      allowedDomains: (arg("domains") ?? "").split(",").filter(Boolean),
      webhookUrl: arg("webhook") ?? null,
      maxEventMonths: arg("max-event-months") ? Number(arg("max-event-months")) : undefined,
      amountLimitPerPayment: arg("amount-limit") ? Number(arg("amount-limit")) : null,
      maxExpiresIn: arg("max-expires-in") ? Number(arg("max-expires-in")) : undefined,
    });
    const { error } = await db.from("merchant_api_credentials").insert(issued.row);
    if (error) throw new Error(`登録に失敗しました: ${error.message}`);
    console.log(`merchant_id : ${issued.apiMerchantId}`);
    console.log(`secret      : ${issued.secret}`);
    console.log("※ secret はこの画面にだけ表示されます。再表示はできません（必要なら rotate）。");
    return;
  }

  if (command === "rotate") {
    const apiMerchantId = arg("api-merchant-id");
    const { data, error } = await db
      .from("merchant_api_credentials")
      .select("id, environment, secret_enc")
      .eq("api_merchant_id", apiMerchantId ?? "")
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) throw new Error("資格情報が見つかりません");
    const { patch, secret } = buildRotation(data, data.environment, new Date());
    const upd = await db.from("merchant_api_credentials").update(patch).eq("id", data.id);
    if (upd.error) throw new Error(`再発行に失敗しました: ${upd.error.message}`);
    console.log(`merchant_id : ${apiMerchantId}`);
    console.log(`secret      : ${secret}`);
    console.log("※ 旧鍵は24時間有効です。");
    return;
  }

  if (command === "list") {
    const { data, error } = await db
      .from("merchant_api_credentials")
      .select("api_merchant_id, environment, secret_last4, allowed_domains, webhook_url, max_event_months, max_expires_in, suspended_at, revoked_at, created_at")
      .eq("merchant_id", arg("merchant") ?? "")
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    console.table(data);
    return;
  }

  throw new Error("使い方: issue | rotate | list（ファイル先頭のコメント参照）");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
