import { describe, expect, it } from "vitest";
import {
  createCheckoutSession,
  decodeCursor,
  encodeCursor,
  getPaymentById,
  getPaymentByOrderId,
  listPayments,
} from "@/lib/merchant-api/service-session";
import { MerchantApiError } from "@/lib/merchant-api/errors";
import { UsenProfileError } from "@/lib/merchant-api/usen-profile";
import { makeCredential, makeDeps, makeRow } from "./helpers";

/** 第6章のリクエスト例（公演日は now=2026-09-28 から3か月以内） */
function request(overrides: Record<string, unknown> = {}) {
  return {
    order_id: "AINY-20260912-000123",
    amount: 6000,
    event: { event_id: "RELIT-VOL13", event_name: "ReLIT定期公演vol.13", event_date: "2026-10-12" },
    items: [{ name: "一般チケット", unit_price: 3000, quantity: 2 }],
    customer: { email: "buyer@example.com" },
    return_url: "https://ainylive.com/checkout/return",
    cancel_url: "https://ainylive.com/checkout/cancel",
    expires_in: 1800,
    ...overrides,
  };
}

/** 非同期の例外コード */
async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof MerchantApiError ? e.code : "other";
  }
}

describe("createCheckoutSession", () => {
  it("201 で作成し、受注コードを採番して expires_at を設定する", async () => {
    const { deps, store } = makeDeps();
    const res = await createCheckoutSession(deps, makeCredential(), request(), "203.0.113.1");
    expect(res.httpStatus).toBe(201);
    expect(res.body.status).toBe("created");
    expect(res.body.redirect_url).toBe(`https://app.qolc.jp/checkout/${res.body.session_id}`);
    expect(res.body.expires_at).toBe("2026-09-28T12:30:00+09:00");
    expect(store.payments[0].usen_jutyu_cd).toBe("TSJM-0000101");
    expect(store.audits.some((a) => a.action === "merchant_session_create")).toBe(true);
  });

  it("同じ order_id の再送は 200 で同じセッション、決済は1件（T-09）", async () => {
    const { deps, store } = makeDeps();
    const first = await createCheckoutSession(deps, makeCredential(), request(), null);
    const second = await createCheckoutSession(deps, makeCredential(), request(), null);
    expect(second.httpStatus).toBe(200);
    expect(second.body.payment_id).toBe(first.body.payment_id);
    expect(second.body.expires_at).toBe(first.body.expires_at);
    expect(store.payments).toHaveLength(1);
  });

  it("同じ order_id で金額・公演が違えば 409", async () => {
    const { deps } = makeDeps();
    await createCheckoutSession(deps, makeCredential(), request(), null);
    const changed = request({ amount: 3000, items: [{ name: "一般チケット", unit_price: 3000, quantity: 1 }] });
    expect(await codeOf(createCheckoutSession(deps, makeCredential(), changed, null))).toBe("order_id_conflict");
    const otherEvent = request({ event: { event_id: "OTHER", event_name: "x", event_date: "2026-10-12" } });
    expect(await codeOf(createCheckoutSession(deps, makeCredential(), otherEvent, null))).toBe("order_id_conflict");
  });

  it("期限切れのセッションを同じ order_id で再送すると 410", async () => {
    const { deps, clock } = makeDeps();
    await createCheckoutSession(deps, makeCredential(), request(), null);
    clock.now = new Date("2026-09-28T04:00:00Z");
    expect(await codeOf(createCheckoutSession(deps, makeCredential(), request(), null))).toBe("session_expired");
  });

  it("テストと本番は注文IDの名前空間が別", async () => {
    const { deps, store } = makeDeps();
    await createCheckoutSession(deps, makeCredential(), request(), null);
    store.credentials.push(makeCredential({ id: "22222222-2222-4222-8222-222222222222", environment: "production" }));
    const res = await createCheckoutSession(deps, store.credentials[1], request(), null);
    expect(res.httpStatus).toBe(201);
    expect(store.payments).toHaveLength(2);
  });

  it("取引停止中は 403 merchant_suspended", async () => {
    const { deps } = makeDeps();
    const cred = makeCredential({ suspended_at: "2026-09-01T00:00:00Z" });
    expect(await codeOf(createCheckoutSession(deps, cred, request(), null))).toBe("merchant_suspended");
  });

  it("USEN 設定不備は 503（決済は作らない）", async () => {
    const { deps, store } = makeDeps();
    deps.resolveProfile = () => {
      throw new UsenProfileError("USEN_TEST_GROUP_ID が設定されていません");
    };
    expect(await codeOf(createCheckoutSession(deps, makeCredential(), request(), null))).toBe("service_unavailable");
    expect(store.payments).toHaveLength(0);
  });

  it("同時リクエストで一意制約に当たったら既存を返す", async () => {
    const { deps, store } = makeDeps();
    const winner = makeRow({ order_id: "AINY-20260912-000123", expires_at: "2026-09-28T03:30:00Z" });
    const original = store.findPaymentByOrder.bind(store);
    let calls = 0;
    // 1回目の検索では見つからず、INSERT 時には他方が作成済みという競合を再現
    store.findPaymentByOrder = async (...args) => (++calls === 1 ? null : original(...args));
    store.payments.push(winner);
    const res = await createCheckoutSession(deps, makeCredential(), request(), null);
    expect(res.httpStatus).toBe(200);
    expect(res.body.payment_id).toBe(winner.payment_id);
  });
});

describe("決済照会", () => {
  it("他加盟店・他環境の決済は 404", async () => {
    const { deps, store } = makeDeps();
    const row = makeRow({ merchant_id: "99999999-9999-4999-8999-999999999999" });
    store.payments.push(row);
    expect(await codeOf(getPaymentById(deps, makeCredential(), row.payment_id))).toBe("payment_not_found");
    const prodRow = makeRow({ environment: "production" });
    store.payments.push(prodRow);
    expect(await codeOf(getPaymentById(deps, makeCredential(), prodRow.payment_id))).toBe("payment_not_found");
  });

  it("期限を過ぎた未着手の決済は照会時に expired を返す（T-05）", async () => {
    const { deps, store, clock } = makeDeps();
    const row = makeRow({ status: "pending" });
    store.payments.push(row);
    clock.now = new Date("2026-09-28T03:31:01Z");
    const res = await getPaymentByOrderId(deps, makeCredential(), row.order_id);
    expect(res.status).toBe("expired");
    expect(store.webhooks.map((w) => w.event_type)).toEqual(["payment.expired"]);
  });
});

describe("取引一覧", () => {
  it("limit+1 件で次ページの有無を判定しカーソルを返す", async () => {
    const { deps, store } = makeDeps();
    for (let i = 0; i < 3; i++) store.payments.push(makeRow({ order_id: `AINY-${i}` }));
    const res = await listPayments(deps, makeCredential(), {
      from: "2026-09-27T00:00:00+09:00",
      to: "2026-09-28T00:00:00+09:00",
      status: "succeeded,refunded",
      event_id: null,
      limit: "2",
      cursor: null,
    });
    expect(res.data).toHaveLength(2);
    expect(res.has_more).toBe(true);
    expect(decodeCursor(res.next_cursor as string).id).toBe(store.payments[1].id);
  });

  it("入力不正は invalid_request", async () => {
    const { deps } = makeDeps();
    const base = { from: "2026-09-01T00:00:00+09:00", to: "2026-09-02T00:00:00+09:00", status: null, event_id: null, limit: null, cursor: null };
    expect(await codeOf(listPayments(deps, makeCredential(), { ...base, from: null }))).toBe("invalid_request");
    expect(await codeOf(listPayments(deps, makeCredential(), { ...base, to: "2026-10-03T00:00:00+09:00" }))).toBe("invalid_request");
    expect(await codeOf(listPayments(deps, makeCredential(), { ...base, limit: "201" }))).toBe("invalid_request");
    expect(await codeOf(listPayments(deps, makeCredential(), { ...base, status: "paid" }))).toBe("invalid_request");
    expect(await codeOf(listPayments(deps, makeCredential(), { ...base, cursor: "bad" }))).toBe("invalid_request");
  });

  it("カーソルはフィルタに埋め込む値を厳格に検証する", () => {
    const evil = Buffer.from(JSON.stringify({ c: "2026-01-01T00:00:00Z),id.gt.(0", i: "x" })).toString("base64url");
    expect(() => decodeCursor(evil)).toThrow(MerchantApiError);
    const row = makeRow();
    expect(decodeCursor(encodeCursor(row))).toEqual({ createdAt: row.created_at, id: row.id });
  });
});
