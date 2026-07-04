import { describe, expect, it } from "vitest";

import { adminApplicationCreateSchema } from "@/lib/applications/admin-intake";

const VALID = {
  source: "contact",
  applicant_name: "山田 太郎",
  message: "7/4 電話受付。加盟店申請の進め方について相談。",
};

describe("adminApplicationCreateSchema（手動起票）", () => {
  it("必須（source / 氏名 / 内容）だけで通過する", () => {
    const r = adminApplicationCreateSchema.safeParse(VALID);
    expect(r.success).toBe(true);
  });

  it("6種すべての source を受け入れる", () => {
    for (const source of [
      "qolc_merchant",
      "jcb_consult",
      "contact",
      "support_facility",
      "support_family",
      "support_provider",
    ]) {
      expect(adminApplicationCreateSchema.safeParse({ ...VALID, source }).success).toBe(true);
    }
  });

  it("未知の source は拒否する", () => {
    expect(
      adminApplicationCreateSchema.safeParse({ ...VALID, source: "unknown" }).success
    ).toBe(false);
  });

  it("氏名・内容が空なら拒否する（日本語メッセージ）", () => {
    const noName = adminApplicationCreateSchema.safeParse({ ...VALID, applicant_name: " " });
    expect(noName.success).toBe(false);
    if (!noName.success) {
      expect(noName.error.issues[0]?.message).toContain("お名前");
    }
    const noMsg = adminApplicationCreateSchema.safeParse({ ...VALID, message: "" });
    expect(noMsg.success).toBe(false);
  });

  it("メールは形式検証（空文字は許容）、電話は20文字までゆるく許容", () => {
    expect(
      adminApplicationCreateSchema.safeParse({ ...VALID, applicant_email: "bad-email" }).success
    ).toBe(false);
    expect(
      adminApplicationCreateSchema.safeParse({ ...VALID, applicant_email: "" }).success
    ).toBe(true);
    expect(
      adminApplicationCreateSchema.safeParse({ ...VALID, applicant_phone: "090-1234-5678 内線2" })
        .success
    ).toBe(true);
    expect(
      adminApplicationCreateSchema.safeParse({
        ...VALID,
        applicant_phone: "123456789012345678901",
      }).success
    ).toBe(false);
  });

  it("内容は2000文字まで", () => {
    expect(
      adminApplicationCreateSchema.safeParse({ ...VALID, message: "あ".repeat(2000) }).success
    ).toBe(true);
    expect(
      adminApplicationCreateSchema.safeParse({ ...VALID, message: "あ".repeat(2001) }).success
    ).toBe(false);
  });
});
