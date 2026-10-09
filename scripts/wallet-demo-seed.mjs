#!/usr/bin/env node
/**
 * QOLC Wallet デモ用データの投入（開発・デモ用 Supabase だけ。何度実行しても同じ状態になる）。
 *
 *   node scripts/wallet-demo-seed.mjs           （投入・更新）
 *   node scripts/wallet-demo-seed.mjs --reset   （デモの記録を消して初期状態に戻す）
 *
 * - 接続先は .env.local.dev。本番の ref なら止まる
 * - 架空の施設2つ（デモ施設・照合確認用の施設B）、施設アカウント2つ、入居者（5人＋1人）、子カード（下4桁のみ）
 * - 施設アカウントのパスワードは初回だけ生成し、.env.local.dev に追記する（チャット・ログに出さない）
 * - 実在の入居者・職員の情報は使わない
 */
import { createHash, randomInt } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ENV_PATH = new URL("../.env.local.dev", import.meta.url);
const DEV_REF = "tqmbxszimkavivwbbdjw";
const PROD_REF = "fxcgclgoopjgaopawgiw";

/** .env ファイルを読む */
function readEnv() {
  return Object.fromEntries(
    readFileSync(ENV_PATH, "utf8").split("\n")
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
  );
}

/** 紛らわしい文字（I l 1 O 0 o）を除いたパスワード */
function password(length = 14) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => chars[randomInt(chars.length)]).join("");
}

const env = readEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes(DEV_REF) || url.includes(PROD_REF)) {
  console.error("接続先が開発・デモ用（qolc-dev）ではありません。中止します。");
  process.exit(1);
}
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const FACILITIES = [
  { id: "a0000000-0000-4000-8000-000000000001", name: "デモ施設 さくらの里（デモ）", email: "wallet-demo@uni-dev.jp", pwKey: "WALLET_DEMO_STAFF_PASSWORD" },
  { id: "a0000000-0000-4000-8000-000000000002", name: "デモ施設B（照合確認用）", email: "wallet-demo-b@uni-dev.jp", pwKey: "WALLET_DEMO_STAFF_B_PASSWORD" },
];
const CARDS = [
  { id: "c0000000-0000-4000-8000-000000000001", facility_id: FACILITIES[0].id, label: "子カード（Apple Pay）", last4: "7152", brand: "JCB", credential_type: "apple_pay" },
  { id: "c0000000-0000-4000-8000-000000000002", facility_id: FACILITIES[1].id, label: "子カード", last4: "6963", brand: "JCB", credential_type: "physical" },
];
const RESIDENTS = [
  ["森", "はるこ", "もり", "はるこ", "101"], ["川口", "たけし", "かわぐち", "たけし", "102"],
  ["花村", "よしえ", "はなむら", "よしえ", "103"], ["木下", "まさお", "きのした", "まさお", "201"],
  ["空野", "ちよ", "そらの", "ちよ", "202"],
].map(([nl, nf, kl, kf, room], i) => ({
  id: `b0000000-0000-4000-8000-00000000000${i + 1}`, facility_id: FACILITIES[0].id,
  name_last: nl, name_first: nf, name_last_kana: kl, name_first_kana: kf, room_label: room,
  insurance_number: `DEMO00000${i + 1}`, wallet_enabled: true,
}));
RESIDENTS.push({
  id: "b0000000-0000-4000-8000-000000000099", facility_id: FACILITIES[1].id, name_last: "別施設", name_first: "たろう",
  name_last_kana: "べつしせつ", name_first_kana: "たろう", room_label: "301", insurance_number: "DEMO000099", wallet_enabled: true,
});

/** 失敗したら止める */
function must({ error }, what) {
  if (error) { console.error(`✗ ${what}: ${error.message}`); process.exit(1); }
  console.log(`✓ ${what}`);
}

must(await admin.from("facilities").upsert(FACILITIES.map(({ id, name }) => ({ id, name }))), "施設");
must(await admin.from("facility_cards").upsert(CARDS), "子カード（下4桁のみ）");
must(await admin.from("residents").upsert(RESIDENTS), "入居者（架空）");

for (const f of FACILITIES) {
  let pw = env[f.pwKey];
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users.find((u) => u.email === f.email);
  const meta = { app_metadata: { role: "facility_staff", facility_id: f.id } };
  if (!user) {
    pw = password();
    const created = await admin.auth.admin.createUser({ email: f.email, password: pw, email_confirm: true, ...meta });
    if (created.error) { console.error(`✗ ${f.email}: ${created.error.message}`); process.exit(1); }
    user = created.data.user;
    appendFileSync(ENV_PATH, `\n# QOLC Wallet デモ用 施設アカウント（${f.email}）\n${f.pwKey}=${pw}\n`);
  } else {
    await admin.auth.admin.updateUserById(user.id, meta);
  }
  must(await admin.from("profiles").update({ role: "facility_staff", facility_id: f.id, display_name: f.name })
    .eq("id", user.id), `施設アカウント ${f.email}`);

  // 実際にログインできることを確かめる（パスワードは表示しない）
  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const login = await anon.auth.signInWithPassword({ email: f.email, password: pw });
  const claims = login.data.session
    ? JSON.parse(Buffer.from(login.data.session.access_token.split(".")[1], "base64url").toString())
    : null;
  console.log(login.error
    ? `✗ ログイン確認 ${f.email}: ${login.error.message}`
    : `✓ ログイン確認 ${f.email}（role=${claims?.app_metadata?.role}, facility=${claims?.app_metadata?.facility_id === f.id ? "一致" : "不一致"}）`);
}

// 運営センター（admin）のデモ用アカウント（明細の取込・突合の画面用）
{
  const email = "wallet-demo-admin@uni-dev.jp";
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users.find((u) => u.email === email);
  if (!user) {
    const pw = password();
    const created = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, app_metadata: { role: "admin" } });
    if (created.error) { console.error(`✗ ${email}: ${created.error.message}`); process.exit(1); }
    user = created.data.user;
    appendFileSync(ENV_PATH, `\n# QOLC デモ用 運営センター（admin）アカウント（${email}）\nWALLET_DEMO_ADMIN_PASSWORD=${pw}\n`);
  }
  must(await admin.from("profiles").update({ role: "admin", facility_id: null, display_name: "デモ運営センター" }).eq("id", user.id), `運営センターアカウント ${email}`);
}

// デモ用 iPhone（端末）と、支払いの自動記録の鍵（鍵は .env.local.dev にだけ置き、DB にはハッシュだけ）
{
  let key = env.WALLET_DEMO_DEVICE_KEY;
  if (!key) {
    key = password(32);
    appendFileSync(ENV_PATH, `\n# QOLC Wallet デモ用 iPhone の自動記録の鍵（ショートカットに設定する）\nWALLET_DEMO_DEVICE_KEY=${key}\n`);
  }
  const hash = createHash("sha256").update(key, "utf8").digest("hex");
  must(await admin.from("devices").upsert({
    id: "d0000000-0000-4000-8000-000000000001", facility_id: FACILITIES[0].id, name: "デモ iPhone",
    card_id: CARDS[0].id, status: "active", auto_record_key_hash: hash,
  }), "デモ用 iPhone（自動記録の鍵）");
}

// --reset: デモの記録・レシート・明細の取込を論理削除して、何もない状態に戻す（リハーサル用）
if (process.argv.includes("--reset")) {
  const ids = FACILITIES.map((f) => f.id);
  const now = new Date().toISOString();
  must(await admin.from("wallet_auto_records").update({ deleted_at: now }).in("facility_id", ids).is("deleted_at", null), "自動記録を論理削除");
  must(await admin.from("receipt_images").update({ deleted_at: now }).in("facility_id", ids).is("deleted_at", null), "レシートを論理削除");
  must(await admin.from("purchase_declarations").update({ deleted_at: now }).in("facility_id", ids).is("deleted_at", null), "記録を論理削除");
  const { data: lines } = await admin.from("card_statement_lines").select("import_id").in("facility_id", ids).is("deleted_at", null);
  const importIds = Array.from(new Set((lines ?? []).map((l) => l.import_id)));
  if (importIds.length > 0) {
    must(await admin.from("card_statement_lines").update({ deleted_at: now }).in("import_id", importIds), "明細行を論理削除");
    must(await admin.from("card_statement_imports").update({ deleted_at: now }).in("id", importIds), "明細の取込を論理削除");
  }
}
