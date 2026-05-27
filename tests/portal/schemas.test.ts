/**
 * 管理データフォームの zod スキーマテスト
 */
import { describe, it, expect } from "vitest";
import {
  facilityFormSchema,
  merchantFormSchema,
  residentFormSchema,
} from "../../src/lib/portal/schemas";

describe("facilityFormSchema", () => {
  it("最小有効値を受理", () => {
    const r = facilityFormSchema.safeParse({ name: "〇〇施設", display_frequency: "monthly" });
    expect(r.success).toBe(true);
  });
  it("施設名空はエラー", () => {
    const r = facilityFormSchema.safeParse({ name: "  ", display_frequency: "monthly" });
    expect(r.success).toBe(false);
  });
  it("電話番号は数字とハイフンのみ", () => {
    expect(facilityFormSchema.safeParse({ name: "A", phone: "03-1234-5678", display_frequency: "monthly" }).success).toBe(true);
    expect(facilityFormSchema.safeParse({ name: "A", phone: "03(1234)5678", display_frequency: "monthly" }).success).toBe(false);
  });
  it("display_frequency は enum のみ", () => {
    expect(facilityFormSchema.safeParse({ name: "A", display_frequency: "weekly" }).success).toBe(false);
  });
  it("空電話番号(空文字)は許容", () => {
    expect(facilityFormSchema.safeParse({ name: "A", phone: "", display_frequency: "bimonthly" }).success).toBe(true);
  });
});

describe("merchantFormSchema", () => {
  it("名前のみで有効", () => {
    expect(merchantFormSchema.safeParse({ name: "テスト診療所" }).success).toBe(true);
  });
  it("名前空はエラー", () => {
    expect(merchantFormSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("residentFormSchema", () => {
  it("姓名+被保険者番号で有効", () => {
    const r = residentFormSchema.safeParse({
      name_last: "山田",
      name_first: "太郎",
      insurance_number: "0000000001",
    });
    expect(r.success).toBe(true);
  });
  it("被保険者番号が数字以外はエラー", () => {
    expect(
      residentFormSchema.safeParse({ name_last: "山田", name_first: "太郎", insurance_number: "ABC123" }).success
    ).toBe(false);
  });
  it("被保険者番号11桁以上はエラー", () => {
    expect(
      residentFormSchema.safeParse({ name_last: "山田", name_first: "太郎", insurance_number: "01234567890" }).success
    ).toBe(false);
  });
  it("姓が空はエラー", () => {
    expect(
      residentFormSchema.safeParse({ name_last: "", name_first: "太郎", insurance_number: "1" }).success
    ).toBe(false);
  });
});
