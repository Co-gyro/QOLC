#!/usr/bin/env node
/**
 * 支払いの自動記録 API の確認（開発・デモ用環境だけ）。
 *   node scripts/wallet-auto-record-check.mjs            受け口の動作確認（鍵・結びつけ）
 *   node scripts/wallet-auto-record-check.mjs --list     届いた自動記録の一覧（実機検証の結果を見る）
 * 接続先は WALLET_API_BASE（既定 https://demo.qolc.jp）。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.WALLET_API_BASE ?? "https://demo.qolc.jp";
const env = Object.fromEntries(readFileSync(new URL("../.env.local.dev", import.meta.url), "utf8").split("\n")
  .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes("tqmbxszimkavivwbbdjw")) { console.error("qolc-dev ではありません"); process.exit(1); }
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (process.argv.includes("--list")) {
  const { data } = await admin.from("wallet_auto_records")
    .select("received_at, merchant_name, amount, amount_text, card_name, transaction_name, link_status, raw")
    .is("deleted_at", null).order("received_at", { ascending: false }).limit(20);
  for (const r of data ?? []) {
    const t = new Date(r.received_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    console.log(`${t}  店=${r.merchant_name ?? "（なし）"}  金額=${r.amount ?? "（読めず）"}［${r.amount_text ?? ""}］  カード=${r.card_name ?? "（なし）"}  名前=${r.transaction_name ?? ""}  → ${r.link_status}`);
    console.log("   届いた内容:", JSON.stringify(r.raw));
  }
  if (!data?.length) console.log("まだ届いていません");
  process.exit(0);
}

let failures = 0;
const check = (ok, label, detail = "") => { console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `（${detail}）` : ""}`); if (!ok) failures++; };
const post = (key, body) => fetch(`${BASE}/api/wallet/auto-records`, {
  method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

check((await post("x".repeat(32), {})).status === 401, "違う鍵は 401");
const key = env.WALLET_DEMO_DEVICE_KEY;
const lone = await post(key, { merchant: "テスト店", amount: "¥500", card: "テストカード", name: "検証" });
check(lone.status === 201 && lone.json?.data?.linked === false, "記録のない支払い → 結びつかない（要確認の候補）");

const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: s } = await c.auth.signInWithPassword({ email: "wallet-demo@uni-dev.jp", password: env.WALLET_DEMO_STAFF_PASSWORD });
const api = (m, p, b) => fetch(`${BASE}${p}`, { method: m, headers: { authorization: `Bearer ${s.session.access_token}`, "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then((r) => r.json());
const resident = (await api("GET", "/api/wallet/residents")).data.residents[0];
const d = (await api("POST", "/api/wallet/declarations", { resident_id: resident.id, payment_method: "apple_pay" })).data.declaration;
const linked = await post(key, { merchant: "ﾌｧﾐﾘｰﾏｰﾄ", amount: "¥319", card: "JCB" });
check(linked.json?.data?.linked === true, "選択中の記録がある支払い → 結びつく（支払い完了の押し忘れも補える）");
const { data: row } = await admin.from("purchase_declarations").select("auto_amount, auto_merchant_name").eq("id", d.id).single();
check(row?.auto_amount === 319 && row?.auto_merchant_name === "ファミリーマート", "記録に自動の金額・店名が入る");

console.log(failures === 0 ? "\nすべて合格（確認用のデータは scripts/wallet-demo-seed.mjs --reset で消せます）" : `\n${failures} 件失敗`);
process.exit(failures === 0 ? 0 : 1);
