import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  belongsToMall,
  completeCardRegistration,
  extractMemberCard,
  initCardToken,
  type CardRegistrationDeps,
  type RegistrationContext,
} from "@/lib/udpay/prod/card-registration";
import type { ProdCustomer } from "@/lib/udpay/prod/customers";

const CUSTOMER: ProdCustomer = {
  id: "11111111-2222-3333-4444-555555555555",
  merchantId: "m1",
  name: "さくら歯科",
  contactName: "田中",
  chargeDay: 15,
  billingNote: null,
  internalMemo: null,
  postalCode: null,
  address1: null,
  address2: null,
  registrationToken: "t".repeat(32),
  usenMemberId: null,
  cardBrand: null,
  cardLast4: null,
  cardExpireYm: null,
  cardRegisteredAt: null,
  contacts: [
    { kind: "cc", name: null, email: "cc@example.com" },
    { kind: "to", name: "田中", email: "to@example.com" },
  ],
};

/** テスト用の文脈（ランサイド様 A303） */
function ctx(over: Partial<ProdCustomer> = {}): RegistrationContext {
  return {
    customer: { ...CUSTOMER, ...over },
    merchant: { id: "m1", name: "株式会社ランサイド", mallCode: "A303", chargeDays: [15, 28], contactPerson: null, replyTo: null, logoPath: null },
    memberId: "U11111111222233334444555555555555",
  };
}

/** 更新内容を記録する Supabase の偽物 */
function fakeClient() {
  const updates: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      update: (v: Record<string, unknown>) => {
        updates.push(v);
        return { eq: async () => ({ error: null }) };
      },
    }),
  } as unknown as SupabaseClient;
  return { client, updates };
}

/** 偽の依存 */
function deps(over: Partial<CardRegistrationDeps> = {}) {
  const { client, updates } = fakeClient();
  const d: CardRegistrationDeps = {
    client,
    nextJutyuCd: vi.fn(async () => "A303-0000002"),
    tokenInit: vi.fn(async () => ({ result: "ok", code: "00" })),
    pay: vi.fn(async () => ({ result: "ok", code: "00", brand: "VISA", member_id: "U11111111222233334444555555555555" })),
    memberGet: vi.fn(async () => ({
      result: "ok",
      code: "50",
      member_data: "<card_num>4980************5001</card_num><expire_yyyy>2028</expire_yyyy><expire_mm>08</expire_mm><ucorp>VISA</ucorp>",
    })),
    audit: vi.fn(async () => true),
    formatUsenDate: () => "2026/10/09",
    ...over,
  };
  return { d, updates };
}

const INIT_BODY = { jutyu_cd: "A303-0000001", token: "tk", card_limit_yyyy: "2028", card_limit_mm: "08", cardholder_name: "TARO" };

describe("belongsToMall", () => {
  it("加盟店のモールコードで採番した受注コードだけ受け付ける", () => {
    expect(belongsToMall("A303-0000001", "A303")).toBe(true);
    expect(belongsToMall("A300-0000001", "A303")).toBe(false);
    expect(belongsToMall("A303-1", "A303")).toBe(false);
  });
});

describe("initCardToken", () => {
  it("1円・会員ID・3DS用メール（To の先頭）で USEN を呼ぶ。初回は member-modify なし", async () => {
    const { d } = deps();
    const r = await initCardToken(d, ctx(), INIT_BODY);
    expect(r.ok).toBe(true);
    expect(d.tokenInit).toHaveBeenCalledWith(
      expect.objectContaining({
        sum_price: 1,
        member_id: "U11111111222233334444555555555555",
        option: undefined,
        three_ds_cardholder_info: { email: "to@example.com" },
        jutyu_day: "2026/10/09",
      }),
    );
    expect(d.audit).toHaveBeenCalled();
  });
  it("登録済みの顧客は member-modify でカードを上書きする", async () => {
    const { d } = deps();
    await initCardToken(d, ctx({ usenMemberId: "U11111111222233334444555555555555" }), INIT_BODY);
    expect(d.tokenInit).toHaveBeenCalledWith(expect.objectContaining({ option: "member-modify" }));
  });
  it("他のモールの受注コード・宛先なしは USEN を呼ばない", async () => {
    const { d } = deps();
    expect((await initCardToken(d, ctx(), { ...INIT_BODY, jutyu_cd: "A300-0000001" })).ok).toBe(false);
    expect((await initCardToken(d, ctx({ contacts: [] }), INIT_BODY)).ok).toBe(false);
    expect(d.tokenInit).not.toHaveBeenCalled();
  });
});

describe("completeCardRegistration", () => {
  const PAY_BODY = { jutyu_cd: "A303-0000001", token: "tk", check_cd: "cc" };

  it("成功時は会員ID・ブランド・下4桁・有効期限を保存する", async () => {
    const { d, updates } = deps();
    const r = await completeCardRegistration(d, ctx(), PAY_BODY);
    expect(r).toEqual({ ok: true, brand: "VISA", last4: "5001", expireYm: "202808" });
    expect(updates[0]).toMatchObject({
      usen_member_id: "U11111111222233334444555555555555",
      card_brand: "VISA",
      card_last4: "5001",
      card_expire_ym: "202808",
    });
  });
  it("会員情報が取れなくても登録は成功扱い（有効期限は空）", async () => {
    const { d, updates } = deps({ memberGet: vi.fn(async () => { throw new Error("timeout"); }) });
    const r = await completeCardRegistration(d, ctx(), PAY_BODY);
    expect(r.ok).toBe(true);
    expect(updates[0]).toMatchObject({ card_expire_ym: null, card_checked_at: null });
  });
  it("失敗時は保存せず、入力し直し用の新しい受注コードを返す", async () => {
    const { d, updates } = deps({ pay: vi.fn(async () => ({ result: "ng", code: "02" })) });
    const r = await completeCardRegistration(d, ctx(), PAY_BODY);
    expect(r).toEqual({ ok: false, error: "カードを登録できませんでした（code=02）", retryJutyuCd: "A303-0000002" });
    expect(updates).toHaveLength(0);
  });
});

describe("extractMemberCard", () => {
  it("入れ子の member_data から取り出す（平坦な形でも読める）", () => {
    expect(extractMemberCard({ result: "ok", card_num: "4111********1111", expire_yyyy: "2030", expire_mm: "1" })).toEqual({
      last4: "1111",
      expireYm: "203001",
      brand: null,
    });
  });
});
