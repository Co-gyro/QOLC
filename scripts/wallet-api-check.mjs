#!/usr/bin/env node
/**
 * QOLC Wallet API の通し確認（開発・デモ用環境だけ）。
 *
 *   scripts/wallet-dev.sh を起動したうえで:  node scripts/wallet-api-check.mjs
 *
 * 施設アカウント A で 選択→支払い完了→金額→レシート登録 を行い、
 * 施設 B からは A の記録が API でも RLS でも見えないことを確かめる。作った記録は最後に取り消す。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.WALLET_API_BASE ?? "http://localhost:3100";
const env = Object.fromEntries(readFileSync(new URL("../.env.local.dev", import.meta.url), "utf8").split("\n")
  .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes("tqmbxszimkavivwbbdjw")) { console.error("qolc-dev ではありません"); process.exit(1); }

// 1x1 の JPEG
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");

let failures = 0;
/** 結果を表示する */
function check(ok, label, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `（${detail}）` : ""}`);
  if (!ok) failures += 1;
}

/** ログインしてトークンと RLS 用クライアントを返す */
async function login(email, password) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { token: data.session.access_token, client };
}

/** API を呼ぶ */
async function api(token, method, path, body) {
  const init = { method, headers: { authorization: `Bearer ${token}` } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.body = JSON.stringify(body); init.headers["content-type"] = "application/json"; }
  const res = await fetch(`${BASE}${path}`, init);
  return { status: res.status, json: await res.json().catch(() => null) };
}

const A = await login("wallet-demo@uni-dev.jp", env.WALLET_DEMO_STAFF_PASSWORD);
const B = await login("wallet-demo-b@uni-dev.jp", env.WALLET_DEMO_STAFF_B_PASSWORD);

const unauth = await fetch(`${BASE}/api/wallet/residents`);
check(unauth.status === 401, "ログインなしは 401", String(unauth.status));

const residents = await api(A.token, "GET", "/api/wallet/residents");
check(residents.status === 200 && residents.json.data.residents.length === 5, "A の入居者は5人", String(residents.json?.data?.residents?.length));
const mori = residents.json.data.residents.find((r) => r.name_last === "森");

const created = await api(A.token, "POST", "/api/wallet/declarations", { resident_id: mori.id, payment_method: "apple_pay" });
const id = created.json?.data?.declaration?.id;
check(created.status === 201 && created.json.data.declaration.status === "selecting", "記録を作る", created.json?.data?.declaration?.resident_name);

const otherResident = await api(B.token, "POST", "/api/wallet/declarations", { resident_id: mori.id, payment_method: "apple_pay" });
check(otherResident.status === 404, "B は A の入居者で記録を作れない", String(otherResident.status));

const paid = await api(A.token, "POST", `/api/wallet/declarations/${id}/paid`, { payment_method: "apple_pay" });
check(paid.json?.data?.declaration?.status === "awaiting_receipt", "支払い完了 → レシート待ち");
const paidAgain = await api(A.token, "POST", `/api/wallet/declarations/${id}/paid`, { payment_method: "apple_pay" });
check(paidAgain.status === 409, "二重の支払い完了は 409", String(paidAgain.status));

const amount = await api(A.token, "POST", `/api/wallet/declarations/${id}/amount`, { amount: 300 });
check(amount.json?.data?.declaration?.entered_amount === 300, "金額の入力");

const bPaid = await api(B.token, "POST", `/api/wallet/declarations/${id}/paid`, { payment_method: "apple_pay" });
check(bPaid.status === 404, "B は A の記録を変更できない", String(bPaid.status));

const pending = await api(A.token, "GET", "/api/wallet/declarations/pending");
check(pending.json?.data?.declarations?.some((d) => d.id === id), "A のレシート待ちに出る");
const bPending = await api(B.token, "GET", "/api/wallet/declarations/pending");
check(!bPending.json?.data?.declarations?.some((d) => d.id === id), "B のレシート待ちには出ない");

const form = new FormData();
form.set("declaration_id", id);
form.set("amount", "320");
form.set("merchant_name", "FamilyMart テスト店");
form.set("printed_at", new Date().toISOString());
form.set("ocr_items", JSON.stringify([{ name: "お茶", amount: 320 }]));
form.set("ocr_payment_label", "クレジット（JCB）");
form.set("ocr_card_last4", "7152");
form.set("image", new Blob([JPEG], { type: "image/jpeg" }), "receipt.jpg");
const receipt = await api(A.token, "POST", "/api/wallet/receipts", form);
const d = receipt.json?.data?.declaration;
check(receipt.status === 200 && d?.status === "mismatched" && receipt.json.data.warnings.length === 1,
  "レシート登録（入力金額と違う → 要確認）", receipt.json?.data?.warnings?.join(" / "));
check(Boolean(d?.receipt_image_url) && d?.receipt_items?.[0]?.name === "お茶", "画像の署名付き URL と明細が返る");
const img = d?.receipt_image_url ? await fetch(d.receipt_image_url) : null;
check(img?.status === 200, "画像を取得できる", String(img?.status));

const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const list = await api(A.token, "GET", `/api/wallet/declarations?date=${today}`);
check(list.json?.data?.declarations?.some((x) => x.id === id), "今日の一覧に出る");

// RLS: 直接 DB を読んでも、B からは A の記録・レシートが見えない
const rlsA = await A.client.from("purchase_declarations").select("id").eq("id", id);
const rlsB = await B.client.from("purchase_declarations").select("id").eq("id", id);
const rlsBReceipt = await B.client.from("receipt_images").select("id").eq("declaration_id", id);
check(rlsA.data?.length === 1, "RLS: A は自施設の記録を読める");
check(rlsB.data?.length === 0 && rlsBReceipt.data?.length === 0, "RLS: B は A の記録・レシートを読めない");
const write = await A.client.from("purchase_declarations").update({ amount: 1 }).eq("id", id).select("id");
check((write.data ?? []).length === 0, "RLS: 施設アカウントは DB を直接書き換えられない");

// 後片付け（記録は取り消し、レシートは残る）
await api(A.token, "POST", `/api/wallet/declarations/${id}/cancel`).then((r) =>
  check(r.status === 409, "要確認の記録は取消できない（状態の制約）", String(r.status)));

console.log(failures === 0 ? "\nすべて合格" : `\n${failures} 件失敗`);
process.exit(failures === 0 ? 0 : 1);
