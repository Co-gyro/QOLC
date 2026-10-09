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
    // 既定: A303 の実挙動（トークン決済では会員が作られない）→ 1回目の取得は 51、登録後は取得できる
    memberGet: vi
      .fn()
      .mockResolvedValueOnce({ result: "ng", code: "51" })
      .mockResolvedValue(MEMBER_NEW),
    memberEntryByJutyuCd: vi.fn(async () => ({ result: "ok", code: "50" })),
    memberDelete: vi.fn(async () => ({ result: "ok", code: "50" })),
    searchTrade: vi.fn(async () => ({ result: "ok", code: "01", card_num: "498012******5001", expire_yyyy: "2028", expire_mm: "08" })),
    audit: vi.fn(async () => true),
    formatUsenDate: () => "2026/10/09",
    ...over,
  };
  return { d, updates };
}

const MEMBER_NEW = {
  result: "ok",
  code: "50",
  member_data: "<card_num>4980************5001</card_num><expire_yyyy>2028</expire_yyyy><expire_mm>08</expire_mm><ucorp>VISA</ucorp>",
};
const MEMBER_OLD = {
  result: "ok",
  code: "50",
  member_data: "<card_num>3587************0000</card_num><expire_yyyy>2026</expire_yyyy><expire_mm>12</expire_mm><ucorp>JCB</ucorp>",
};

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

  it("初回: 会員が無ければ受注コードから会員を作り、会員ID・ブランド・下4桁・有効期限を保存する", async () => {
    const { d, updates } = deps();
    const r = await completeCardRegistration(d, ctx(), PAY_BODY);
    expect(r).toEqual({ ok: true, brand: "VISA", last4: "5001", expireYm: "202808" });
    expect(d.memberEntryByJutyuCd).toHaveBeenCalledWith({ memberId: "U11111111222233334444555555555555", jutyuCd: "A303-0000001" });
    expect(d.memberDelete).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({
      usen_member_id: "U11111111222233334444555555555555",
      card_brand: "VISA",
      card_last4: "5001",
      card_expire_ym: "202808",
    });
  });
  it("カード変更: 会員のカードが今回の与信と違えば、削除して作り直す", async () => {
    const memberGet = vi.fn().mockResolvedValueOnce(MEMBER_OLD).mockResolvedValue(MEMBER_NEW);
    const { d, updates } = deps({ memberGet });
    const r = await completeCardRegistration(d, ctx({ usenMemberId: "U11111111222233334444555555555555" }), PAY_BODY);
    expect(r.ok).toBe(true);
    expect(d.memberDelete).toHaveBeenCalled();
    expect(d.memberEntryByJutyuCd).toHaveBeenCalled();
    expect(updates[0]).toMatchObject({ card_last4: "5001", card_expire_ym: "202808" });
  });
  it("会員が既に今回のカードなら、そのまま保存する（登録し直さない）", async () => {
    const { d } = deps({ memberGet: vi.fn(async () => MEMBER_NEW) });
    expect((await completeCardRegistration(d, ctx(), PAY_BODY)).ok).toBe(true);
    expect(d.memberEntryByJutyuCd).not.toHaveBeenCalled();
    expect(d.memberDelete).not.toHaveBeenCalled();
  });
  it("会員を作れなければ登録失敗として保存せず、入力し直し用の受注コードを返す", async () => {
    const { d, updates } = deps({ memberEntryByJutyuCd: vi.fn(async () => ({ result: "ng", code: "52" })) });
    const r = await completeCardRegistration(d, ctx(), PAY_BODY);
    expect(r.ok).toBe(false);
    expect(updates).toHaveLength(0);
  });
  it("与信が失敗したら保存せず、入力し直し用の新しい受注コードを返す", async () => {
    const { d, updates } = deps({ pay: vi.fn(async () => ({ result: "ng", code: "02" })) });
    const r = await completeCardRegistration(d, ctx(), PAY_BODY);
    expect(r).toEqual({ ok: false, error: "カードを登録できませんでした（code=02）", retryJutyuCd: "A303-0000002" });
    expect(updates).toHaveLength(0);
    expect(d.memberEntryByJutyuCd).not.toHaveBeenCalled();
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
