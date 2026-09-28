import { describe, expect, it } from "vitest";
import { expireDuePayments, expireIfDue, isPastExpiry, reconcile, transition } from "@/lib/merchant-api/service-state";
import { makeCredential, makeDeps, makeRow } from "./helpers";

describe("transition", () => {
  it("状態は前進のみ（終了状態から戻らない）", async () => {
    const { deps, store } = makeDeps();
    const row = makeRow({ status: "failed" });
    store.payments.push(row);
    expect(await transition(deps, row, "succeeded")).toBeNull();
    expect(await transition(deps, row, "pending")).toBeNull();
    expect(store.payments[0].status).toBe("failed");
  });

  it("succeeded → refunded は可能で payment.refunded を積む", async () => {
    const { deps, store } = makeDeps();
    const row = makeRow({ status: "succeeded" });
    store.payments.push(row);
    expect((await transition(deps, row, "refunded"))?.status).toBe("refunded");
    expect(store.webhooks.map((w) => w.event_type)).toEqual(["payment.refunded"]);
  });

  it("終了状態で closed_at を立て、通知先が無ければ通知を積まない", async () => {
    const { deps, store } = makeDeps();
    store.credentials = [makeCredential({ webhook_url: null })];
    const row = makeRow({ status: "pending" });
    store.payments.push(row);
    const done = await transition(deps, row, "expired");
    expect(done?.closed_at).toBe("2026-09-28T03:00:00.000Z");
    expect(store.webhooks).toHaveLength(0);
  });

  it("同じ遷移が同時に走っても1回だけ成立し、通知も1本（T-07 の前提）", async () => {
    const { deps, store } = makeDeps();
    const row = makeRow({ status: "pending" });
    store.payments.push(row);
    const results = await Promise.all([transition(deps, row, "succeeded"), transition(deps, row, "succeeded")]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(store.webhooks).toHaveLength(1);
  });
});

describe("reconcile", () => {
  it("受注コードが無ければ USEN を呼ばない", async () => {
    const { deps, usen } = makeDeps();
    const row = makeRow({ usen_jutyu_cd: null });
    expect(await reconcile(deps, row)).toBe(row);
    expect(usen.calls).toHaveLength(0);
  });

  it("売上済みの決済が照会で返品済みなら refunded", async () => {
    const { deps, store, usen } = makeDeps();
    const row = makeRow({ status: "succeeded" });
    store.payments.push(row);
    usen.trade = { result: "ok", status: "sales_return" };
    expect((await reconcile(deps, row)).status).toBe("refunded");
  });

  it("照会結果を usen_status に記録し、カード番号は監査ログに残さない", async () => {
    const { deps, store, usen } = makeDeps();
    const row = makeRow({ status: "pending" });
    store.payments.push(row);
    usen.trade = { result: "ok", status: "unprocessed", card_num: "411111******1111" };
    const after = await reconcile(deps, row);
    expect(after.usen_status).toBe("unprocessed");
    const log = store.audits.find((a) => a.action === "merchant_search_trade");
    expect(JSON.stringify(log?.response)).not.toContain("411111");
  });
});

describe("期限切れ（T-05）", () => {
  it("猶予（60秒）を過ぎるまでは期限切れにしない", () => {
    const row = makeRow({ status: "pending", expires_at: "2026-09-28T03:30:00Z" });
    expect(isPastExpiry(row, new Date("2026-09-28T03:31:00Z"))).toBe(false);
    expect(isPastExpiry(row, new Date("2026-09-28T03:31:01Z"))).toBe(true);
    expect(isPastExpiry(makeRow({ status: "succeeded" }), new Date("2027-01-01T00:00:00Z"))).toBe(false);
  });

  it("USEN に進んでいない決済は照会せずに expired", async () => {
    const { deps, store, usen, clock } = makeDeps();
    const row = makeRow({ status: "pending" });
    store.payments.push(row);
    clock.now = new Date("2026-09-28T04:00:00Z");
    expect((await expireIfDue(deps, row)).status).toBe("expired");
    expect(usen.calls).toHaveLength(0);
    expect(store.webhooks.map((w) => w.event_type)).toEqual(["payment.expired"]);
  });

  it("決済が進んでいた場合は照会し、売上済みなら succeeded（T-06: 戻りが届かないケース）", async () => {
    const { deps, store, usen, clock } = makeDeps();
    const row = makeRow({ status: "pending", usen_attempted_at: "2026-09-28T03:10:00Z", usen_pay_requested_at: "2026-09-28T03:11:00Z" });
    store.payments.push(row);
    usen.trade = { result: "ok", status: "sales", amount: "6000" };
    clock.now = new Date("2026-09-28T04:00:00Z");
    expect((await expireIfDue(deps, row)).status).toBe("succeeded");
    expect(store.webhooks.map((w) => w.event_type)).toEqual(["payment.succeeded"]);
  });

  it("まとめて処理し、1件の失敗で他を止めない", async () => {
    const { deps, store, clock } = makeDeps();
    const a = makeRow({ status: "pending", order_id: "A", usen_attempted_at: "x" });
    const b = makeRow({ status: "created", order_id: "B" });
    store.payments.push(a, b);
    deps.usen.searchTrade = async () => {
      throw new Error("USEN down");
    };
    clock.now = new Date("2026-09-28T04:00:00Z");
    expect(await expireDuePayments(deps)).toBe(1);
    expect(store.payments.find((p) => p.order_id === "B")?.status).toBe("expired");
    expect(store.payments.find((p) => p.order_id === "A")?.status).toBe("pending");
    expect(store.audits.some((x) => x.action === "merchant_expire_error")).toBe(true);
  });
});
