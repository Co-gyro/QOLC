import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildExpiryMail, runExpiryNotices } from "@/lib/udpay/prod/expiry-notice";
import { fakeSupabase, type FakeTables } from "../helpers/fake-supabase";

function client(tables: FakeTables): SupabaseClient {
  return Object.assign(fakeSupabase(tables), {
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "s_miyaji@runside.example" } } }) } },
  }) as unknown as SupabaseClient;
}

function tables(): FakeTables {
  const base = { merchant_id: "m1", contact_name: "田中", usen_member_id: "Ux", card_brand: "JCB", card_last4: "1109", deleted_at: null };
  return {
    udpay_customers: [
      { ...base, id: "c1", name: "さくら歯科", registration_token: "t".repeat(32), card_expire_ym: "202612" },
      { ...base, id: "c2", name: "みなと歯科", registration_token: "u".repeat(32), card_expire_ym: "202611" },
      { ...base, id: "c3", name: "ひかり歯科", registration_token: "v".repeat(32), card_expire_ym: "202703" },
    ],
    udpay_customer_contacts: [
      { customer_id: "c1", kind: "to", email: "sakura@example.com", deleted_at: null },
      { customer_id: "c2", kind: "to", email: "minato@example.com", deleted_at: null },
    ],
    udpay_merchant_settings: [{ merchant_id: "m1", display_name: "株式会社ランサイド", reply_to: null }],
    udpay_members: [{ merchant_id: "m1", user_id: "u1", deleted_at: null }],
    udpay_mail_logs: [],
  };
}

describe("buildExpiryMail", () => {
  it("前月の案内は「来月末」、期限月は「今月末」と書き、登録リンクを入れる", () => {
    const m = buildExpiryMail({ merchantName: "株式会社ランサイド", customerName: "さくら歯科", contactName: "田中", expireYm: "202612", thisMonth: false, url: "https://x/pay/udpay/t", cardLabel: "JCB 下4桁 1109" });
    expect(m.subject).toBe("【株式会社ランサイド】ご登録カードの有効期限が近づいています");
    expect(m.text).toContain("来月末（2026年12月）");
    expect(m.text).toContain("https://x/pay/udpay/t");
  });
});

describe("runExpiryNotices", () => {
  it("月初以外は何もしない", async () => {
    const send = vi.fn();
    expect(await runExpiryNotices(client(tables()), "2026-11-02", "https://app.qolc.jp", send)).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("11/1: 12月期限（前月）と11月期限（当月）に案内し、加盟店とUDに一覧を送る。同じ月の2回目は送らない", async () => {
    const t = tables();
    const send = vi.fn(async () => ({ sent: true, skipped: false, id: "re" }));
    const r = await runExpiryNotices(client(t), "2026-11-01", "https://app.qolc.jp", send);
    expect(r).toEqual({ sent: 2, skipped: 0, failed: 0 });
    const subjects = (send.mock.calls as unknown as [{ subject: string; to: unknown }][]).map(([m]) => m.subject);
    expect(subjects.filter((s) => s.includes("有効期限が近づいています"))).toHaveLength(2);
    expect(subjects).toContain("【UD Payment】カードの有効期限が近いお客様（2件）");
    expect(subjects.some((s) => s.startsWith("【UD Payment運用】"))).toBe(true);
    expect(t.udpay_mail_logs).toHaveLength(2);
    // 2回目（同じ月）は送らない
    const send2 = vi.fn(async () => ({ sent: true, skipped: false }));
    const r2 = await runExpiryNotices(client(t), "2026-11-01", "https://app.qolc.jp", send2);
    expect(r2.skipped).toBe(2);
  });
});
