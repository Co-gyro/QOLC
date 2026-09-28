import { describe, expect, it } from "vitest";
import {
  CheckoutError,
  checkoutAbort,
  checkoutCancel,
  checkoutPay,
  checkoutTokenInit,
  openCheckout,
} from "@/lib/merchant-api/service-checkout";
import { computeReturnSignature } from "@/lib/merchant-api/signature";
import { makeDeps, makeRow, SECRET } from "./helpers";

const cardBody = (jutyu: string) => ({
  jutyu_cd: jutyu,
  token: "TOKEN",
  card_limit_yyyy: "2028",
  card_limit_mm: "08",
  cardholder_name: "TARO",
});

/** 画面表示→/token/init まで進めた状態を作る */
async function started() {
  const ctx = makeDeps();
  const row = makeRow();
  ctx.store.payments.push(row);
  await openCheckout(ctx.deps, row.session_id);
  await checkoutTokenInit(ctx.deps, row.session_id, cardBody("TSJM-0000001"), null);
  return { ...ctx, row };
}

/** 戻りURLのパラメータを読んで sig を検証する */
function readReturn(url: string) {
  const u = new URL(url);
  const p = Object.fromEntries(u.searchParams.entries());
  const sigOk =
    p.sig ===
    computeReturnSignature(SECRET, { orderId: p.order_id, paymentId: p.payment_id, status: p.status, timestamp: Number(p.t) });
  return { base: `${u.origin}${u.pathname}`, status: p.status, sigOk };
}

describe("openCheckout", () => {
  it("初回表示で created → pending、USEN SDK の初期化値を返す", async () => {
    const { deps, store } = makeDeps();
    const row = makeRow();
    store.payments.push(row);
    const view = await openCheckout(deps, row.session_id);
    expect(view.status).toBe("pending");
    expect(view.usen).toEqual({ jutyuCd: "TSJM-0000001", mallCd: "TSJM", tokenJsUrl: "https://cdn.test/dev.js", sdkApiBaseUrl: null });
    expect(view.returnUrl).toBeNull();
    expect(view.merchantName).toBe("株式会社DD AINY LIVE");
  });

  it("存在しないセッションは 404", async () => {
    const { deps } = makeDeps();
    await expect(openCheckout(deps, "cs_00000000000000000000000000")).rejects.toBeInstanceOf(CheckoutError);
  });

  it("確定済みなら入力欄を出さず、署名付きの戻り先を返す", async () => {
    const { deps, store } = makeDeps();
    const row = makeRow({ status: "succeeded" });
    store.payments.push(row);
    const view = await openCheckout(deps, row.session_id);
    expect(view.usen).toBeNull();
    expect(readReturn(view.returnUrl as string)).toMatchObject({ status: "succeeded", sigOk: true });
  });
});

describe("正常系（T-01）", () => {
  it("/token/init → /pay → 取引照会で succeeded、通知を積み、署名付きで return_url へ", async () => {
    const { deps, store, usen, row } = await started();
    expect(store.payments[0].usen_attempted_at).not.toBeNull();
    usen.trade = { result: "ok", status: "sales", amount: "6000", card_num: "411111******1111", process_date: "2026/09/28 12:05:00" };
    const out = await checkoutPay(deps, row.session_id, { jutyu_cd: "TSJM-0000001", token: "T", check_cd: "HMabc" }, null);
    expect(out.outcome).toBe("redirect");
    expect(readReturn(out.redirectUrl as string)).toEqual({ base: "https://ainylive.com/checkout/return", status: "succeeded", sigOk: true });
    expect(store.payments[0]).toMatchObject({
      status: "succeeded",
      card_brand: "VISA",
      card_last4: "1111",
      captured_at: "2026-09-28T03:05:00.000Z",
    });
    expect(store.webhooks.map((w) => w.event_type)).toEqual(["payment.succeeded"]);
    expect(usen.calls).toEqual(["tokenInit:TSJM-0000001", "pay:TSJM-0000001", "searchTrade:TSJM-0000001"]);
  });

  it("USEN の売上金額が注文と違えば succeeded にしない", async () => {
    const { deps, store, usen, row } = await started();
    usen.trade = { result: "ok", status: "sales", amount: "5000" };
    const out = await checkoutPay(deps, row.session_id, { jutyu_cd: "TSJM-0000001", token: "T", check_cd: "HMabc" }, null);
    expect(out.status).toBe("pending");
    expect(store.audits.some((a) => a.action === "merchant_amount_mismatch")).toBe(true);
  });
});

describe("失敗系", () => {
  it("カード会社の非承認は failed（T-03）", async () => {
    const { deps, store, usen, row } = await started();
    usen.payResult = { result: "ng", code: "02" };
    usen.trade = { result: "ok", status: "unprocessed", auth_result: "ng", auth_code: "02" };
    const out = await checkoutPay(deps, row.session_id, { jutyu_cd: "TSJM-0000001", token: "T", check_cd: "HMabc" }, null);
    expect(readReturn(out.redirectUrl as string).status).toBe("failed");
    expect(store.payments[0].failure_code).toBe("card_declined");
    expect(store.webhooks.map((w) => w.event_type)).toEqual(["payment.failed"]);
  });

  it("/i/pay が ng でも取引照会が売上済みなら succeeded（照会が正）", async () => {
    const { deps, store, usen, row } = await started();
    usen.payResult = { result: "ng", code: "04" };
    usen.trade = { result: "ok", status: "sales", amount: "6000" };
    await checkoutPay(deps, row.session_id, { jutyu_cd: "TSJM-0000001", token: "T", check_cd: "HMabc" }, null);
    expect(store.payments[0].status).toBe("succeeded");
  });

  it("/i/pay が通信エラーで照会も未確定なら pending のまま戻す", async () => {
    const { deps, store, usen, row } = await started();
    usen.payResult = new Error("timeout");
    usen.trade = { result: "ok", status: "unprocessed" };
    const out = await checkoutPay(deps, row.session_id, { jutyu_cd: "TSJM-0000001", token: "T", check_cd: "HMabc" }, null);
    expect(readReturn(out.redirectUrl as string).status).toBe("pending");
    expect(store.payments[0].status).toBe("pending");
  });

  it("本人認証の失敗は failed（T-02）", async () => {
    const { deps, store, row } = await started();
    const out = await checkoutAbort(deps, row.session_id, { jutyu_cd: "TSJM-0000001", error_type: "NG_3DS_BRW_AUTH" });
    expect(out.outcome).toBe("redirect");
    expect(store.payments[0]).toMatchObject({ status: "failed", failure_code: "three_ds_failed" });
  });

  it("通信エラーは受注コードを新しくして入力し直せる", async () => {
    const { deps, store, row } = await started();
    const out = await checkoutAbort(deps, row.session_id, { jutyu_cd: "TSJM-0000001", error_type: "NETWORK" });
    expect(out).toMatchObject({ outcome: "retry", jutyuCd: "TSJM-0000101" });
    expect(store.payments[0]).toMatchObject({ status: "pending", usen_attempted_at: null, usen_jutyu_cd: "TSJM-0000101" });
  });

  it("/token/init が ng なら受注コードを新しくする（USEN の応答はそのまま返す）", async () => {
    const { deps, store, usen } = makeDeps();
    const row = makeRow({ status: "pending" });
    store.payments.push(row);
    usen.tokenInitResult = { result: "ng", code: "05" };
    const res = await checkoutTokenInit(deps, row.session_id, cardBody("TSJM-0000001"), null);
    expect(res).toEqual({ result: "ng", code: "05" });
    expect(store.payments[0]).toMatchObject({ usen_attempted_at: null, usen_jutyu_cd: "TSJM-0000101" });
  });

  it("/token/init の通信エラーも受注コードを新しくして再入力を促す", async () => {
    const { deps, store, usen } = makeDeps();
    const row = makeRow({ status: "pending" });
    store.payments.push(row);
    usen.tokenInitResult = new Error("fetch failed");
    await expect(checkoutTokenInit(deps, row.session_id, cardBody("TSJM-0000001"), null)).rejects.toBeInstanceOf(CheckoutError);
    expect(store.payments[0]).toMatchObject({ usen_attempted_at: null, usen_jutyu_cd: "TSJM-0000101" });
  });
});

describe("会員ID", () => {
  it("決済ごとに一意（英数48桁以内）", async () => {
    const { usenMemberIdFor } = await import("@/lib/merchant-api/service-checkout");
    const row = makeRow();
    expect(usenMemberIdFor(row)).toMatch(/^U[0-9a-f]{32}$/);
    expect(usenMemberIdFor(makeRow())).not.toBe(usenMemberIdFor(row));
  });
});

describe("排他・二重処理", () => {
  it("/token/init は1つの受注コードで1回だけ", async () => {
    const { deps, row } = await started();
    await expect(checkoutTokenInit(deps, row.session_id, cardBody("TSJM-0000001"), null)).rejects.toBeInstanceOf(CheckoutError);
  });

  it("古い受注コードでの /token/init・/pay は受け付けない", async () => {
    const { deps, store, usen, row } = await started();
    await checkoutAbort(deps, row.session_id, { jutyu_cd: "TSJM-0000001", error_type: "NETWORK" });
    await expect(checkoutTokenInit(deps, row.session_id, cardBody("TSJM-0000001"), null)).rejects.toBeInstanceOf(CheckoutError);
    await checkoutPay(deps, row.session_id, { jutyu_cd: "TSJM-0000001", token: "T", check_cd: "HMabc" }, null);
    expect(usen.calls.filter((c) => c.startsWith("pay:"))).toHaveLength(0);
    expect(store.payments[0].status).toBe("pending");
  });

  it("/pay の二重送信で USEN の決済は1回", async () => {
    const { deps, usen, row } = await started();
    usen.trade = { result: "ok", status: "sales", amount: "6000" };
    const body = { jutyu_cd: "TSJM-0000001", token: "T", check_cd: "HMabc" };
    await checkoutPay(deps, row.session_id, body, null);
    const second = await checkoutPay(deps, row.session_id, body, null);
    expect(second.status).toBe("succeeded");
    expect(usen.calls.filter((c) => c.startsWith("pay:"))).toHaveLength(1);
  });

  it("期限切れのセッションには /token/init させない", async () => {
    const { deps, store, clock } = makeDeps();
    const row = makeRow({ status: "pending" });
    store.payments.push(row);
    clock.now = new Date("2026-09-28T03:30:30Z");
    await expect(checkoutTokenInit(deps, row.session_id, cardBody("TSJM-0000001"), null)).rejects.toBeInstanceOf(CheckoutError);
  });
});

describe("中断（T-04）", () => {
  it("cancelled にして cancel_url へ戻す（通知は送らない）", async () => {
    const { deps, store } = makeDeps();
    const row = makeRow({ status: "pending" });
    store.payments.push(row);
    const out = await checkoutCancel(deps, row.session_id);
    expect(readReturn(out.redirectUrl as string)).toEqual({ base: "https://ainylive.com/checkout/cancel", status: "cancelled", sigOk: true });
    expect(store.webhooks).toHaveLength(0);
  });

  it("cancel_url 省略時は return_url へ", async () => {
    const { deps, store } = makeDeps();
    const row = makeRow({ status: "pending", cancel_url: null });
    store.payments.push(row);
    const out = await checkoutCancel(deps, row.session_id);
    expect(readReturn(out.redirectUrl as string).base).toBe("https://ainylive.com/checkout/return");
  });

  it("/i/pay 要求後は中断を受け付けない", async () => {
    const { deps, store } = makeDeps();
    const row = makeRow({ status: "pending", usen_attempted_at: "x", usen_pay_requested_at: "x" });
    store.payments.push(row);
    const out = await checkoutCancel(deps, row.session_id);
    expect(out.status).toBe("pending");
    expect(store.payments[0].status).toBe("pending");
  });
});
