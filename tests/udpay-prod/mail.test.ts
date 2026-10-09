import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCardRegistrationMail, sendCardRegistrationMail } from "@/lib/udpay/prod/mail";
import type { ProdCustomer } from "@/lib/udpay/prod/customers";

describe("buildCardRegistrationMail", () => {
  it("加盟店名・リンク・決済日・1円確認の説明を含む", () => {
    const m = buildCardRegistrationMail({
      merchantName: "株式会社ランサイド",
      customerName: "さくら歯科",
      contactName: "田中",
      url: "https://app.qolc.jp/pay/udpay/abc",
      chargeDay: 15,
    });
    expect(m.subject).toBe("【株式会社ランサイド】お支払いカードご登録のお願い");
    expect(m.text).toContain("田中様");
    expect(m.text).toContain("https://app.qolc.jp/pay/udpay/abc");
    expect(m.text).toContain("毎月15日");
    expect(m.text).toContain("1円の確認");
  });
});

describe("sendCardRegistrationMail", () => {
  const customer = {
    id: "c1",
    name: "さくら歯科",
    contactName: null,
    chargeDay: 28,
    contacts: [
      { kind: "to", name: null, email: "to@example.com" },
      { kind: "cc", name: null, email: "cc@example.com" },
    ],
  } as unknown as ProdCustomer;
  const merchant = { id: "m1", name: "株式会社ランサイド", mallCode: "A303", chargeDays: [15, 28], contactPerson: null, replyTo: "r@example.com", logoPath: null };

  it("To/CC に送り、送付履歴を記録する", async () => {
    const inserted: Record<string, unknown>[] = [];
    const client = { from: () => ({ insert: async (v: Record<string, unknown>) => { inserted.push(v); return { error: null }; } }) } as unknown as SupabaseClient;
    const send = vi.fn(async () => ({ sent: true, skipped: false, id: "re_1" }));
    const r = await sendCardRegistrationMail(client, { customer, merchant, url: "https://x", sentBy: "u1" }, send);
    expect(r.status).toBe("sent");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ["to@example.com"], cc: ["cc@example.com"], replyTo: "r@example.com" }));
    expect(inserted[0]).toMatchObject({ kind: "card_registration", status: "sent", provider_id: "re_1", customer_id: "c1" });
  });
});
