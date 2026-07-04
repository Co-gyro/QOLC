import { describe, expect, it } from "vitest";

import {
  ACCOUNT_ROLES,
  PORTAL_NAMES,
  accountCreateSchema,
} from "@/app/api/admin/accounts/schema";

const FACILITY_ID = "11111111-1111-4111-8111-111111111111";
const MERCHANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("accountCreateSchema", () => {
  it("facility_staff は facilityId 必須で通過する", () => {
    const r = accountCreateSchema.safeParse({
      email: "staff@example.com",
      displayName: "山田 太郎",
      role: "facility_staff",
      facilityId: FACILITY_ID,
    });
    expect(r.success).toBe(true);
  });

  it("facility_staff で facilityId がなければエラー（日本語メッセージ）", () => {
    const r = accountCreateSchema.safeParse({
      email: "staff@example.com",
      displayName: "山田 太郎",
      role: "facility_staff",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("所属施設を指定してください");
    }
  });

  it("provider は merchantId 必須", () => {
    const ok = accountCreateSchema.safeParse({
      email: "clinic@example.com",
      displayName: "訪問診療 担当",
      role: "provider",
      merchantId: MERCHANT_ID,
    });
    expect(ok.success).toBe(true);

    const ng = accountCreateSchema.safeParse({
      email: "clinic@example.com",
      displayName: "訪問診療 担当",
      role: "provider",
    });
    expect(ng.success).toBe(false);
    if (!ng.success) {
      expect(ng.error.issues[0]?.message).toBe("所属提供者（加盟店）を指定してください");
    }
  });

  it("メール形式・氏名空・不正ロールは弾く", () => {
    expect(
      accountCreateSchema.safeParse({
        email: "bad-email",
        displayName: "x",
        role: "facility_staff",
        facilityId: FACILITY_ID,
      }).success
    ).toBe(false);
    expect(
      accountCreateSchema.safeParse({
        email: "a@example.com",
        displayName: "",
        role: "facility_staff",
        facilityId: FACILITY_ID,
      }).success
    ).toBe(false);
    expect(
      accountCreateSchema.safeParse({
        email: "a@example.com",
        displayName: "x",
        role: "admin",
        facilityId: FACILITY_ID,
      }).success
    ).toBe(false);
  });

  it("ロールとポータル名の対応が定義されている", () => {
    expect(ACCOUNT_ROLES).toEqual(["facility_staff", "provider"]);
    expect(PORTAL_NAMES.facility_staff).toBe("施設ポータル");
    expect(PORTAL_NAMES.provider).toBe("提供者ポータル");
  });
});
