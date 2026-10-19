import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildResidentExpiryNotice, runResidentExpiryNotices } from "@/lib/notifications/card-expiry-notice";
import { saveResidentCard } from "@/lib/payment/resident-card";
import { fakeSupabase, type FakeTables } from "../helpers/fake-supabase";

function tables(): FakeTables {
  const base = { is_payment_owner: true, usen_member_id: "Mx", card_brand: "VISA", card_last4: "4242", deleted_at: null };
  return {
    resident_accounts: [
      { ...base, id: "a1", card_expire_ym: "202612" },
      { ...base, id: "a2", card_expire_ym: "202611" },
      { ...base, id: "a3", card_expire_ym: "202705" },
      { ...base, id: "a4", card_expire_ym: "202612", is_payment_owner: false },
    ],
    notifications: [],
  };
}

describe("buildResidentExpiryNotice", () => {
  it("期限とカード・変更ページのリンクを書く", () => {
    const n = buildResidentExpiryNotice({ expireYm: "202612", thisMonth: false, cardLabel: "VISA 下4桁 4242", url: "https://app.qolc.jp/user/card/register?ra=a1" });
    expect(n.title).toBe("ご登録カードの有効期限が近づいています");
    expect(n.body).toContain("来月末（2026年12月）");
    expect(n.body).toContain("/user/card/register?ra=a1");
  });
});

describe("runResidentExpiryNotices", () => {
  it("11/1: 12月期限と11月期限の支払いオーナーだけに案内（支払いオーナー以外・遠い期限は対象外）", async () => {
    const notify = vi.fn(async () => {});
    const r = await runResidentExpiryNotices(fakeSupabase(tables()), "2026-11-01", "https://app.qolc.jp", notify);
    expect(r).toEqual({ notified: 2, skipped: 0 });
    expect((notify.mock.calls as unknown as [unknown, { residentAccountId: string; type: string }][]).map(([, i]) => i.residentAccountId).sort()).toEqual(["a1", "a2"]);
    expect(notify).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: "card_expiring" }));
  });
  it("同じ月に案内済みならスキップ、月初以外は何もしない", async () => {
    const t = tables();
    t.notifications.push({ resident_account_id: "a1", type: "card_expiring", created_at: "2026-11-01T00:00:05+09:00" });
    const notify = vi.fn(async () => {});
    expect(await runResidentExpiryNotices(fakeSupabase(t), "2026-11-01", "https://app.qolc.jp", notify)).toEqual({ notified: 1, skipped: 1 });
    expect(await runResidentExpiryNotices(fakeSupabase(t), "2026-11-02", "https://app.qolc.jp", notify)).toEqual({ notified: 0, skipped: 0 });
  });
  it("042 未適用（取得エラー）なら何もしない", async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ not: () => ({ not: () => ({ is: async () => ({ data: null, error: { code: "42703" } }) }) }) }) }) }) } as unknown as SupabaseClient;
    expect(await runResidentExpiryNotices(client, "2026-11-01", "https://app.qolc.jp")).toEqual({ notified: 0, skipped: 0 });
  });
});

describe("saveResidentCard", () => {
  it("カード変更でも会員IDを上書きし、カード情報を保存する", async () => {
    const t: FakeTables = { resident_accounts: [{ id: "a1", usen_member_id: "Mold" }] };
    expect(await saveResidentCard(fakeSupabase(t), "a1", "Ma1", { brand: "JCB", last4: "1109", expireYm: "203109" })).toEqual({ ok: true });
    expect(t.resident_accounts[0]).toMatchObject({ usen_member_id: "Ma1", card_brand: "JCB", card_last4: "1109", card_expire_ym: "203109" });
  });
});
