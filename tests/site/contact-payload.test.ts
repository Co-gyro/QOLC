import { describe, expect, it } from "vitest";

import {
  CONTACT_CATEGORIES,
  buildContactIntakeBody,
} from "@/app/site/contact/_lib/payload";
import { applicationIntakeSchema, contactFormSchema } from "@/lib/applications/schema";

const FULL = {
  name: "山田 太郎",
  org: "サンプルケア東京",
  email: "taro@example.com",
  phone: "03-1234-5678",
  message: "導入を検討しています。",
};

describe("CONTACT_CATEGORIES", () => {
  it("種別は4択（サービスについて/導入のご相談/取材・提携/その他）", () => {
    expect(CONTACT_CATEGORIES).toEqual([
      "サービスについて",
      "導入のご相談",
      "取材・提携",
      "その他",
    ]);
  });
});

describe("buildContactIntakeBody", () => {
  it("フォーム値を intake API の項目へマップする（source=contact）", () => {
    const body = buildContactIntakeBody(FULL, "導入のご相談");
    expect(body.source).toBe("contact");
    expect(body.applicant_name).toBe("山田 太郎");
    expect(body.applicant_org).toBe("サンプルケア東京");
    expect(body.applicant_email).toBe("taro@example.com");
    expect(body.applicant_phone).toBe("03-1234-5678");
    expect(body.message).toBe("導入を検討しています。");
    expect(body.payload).toMatchObject({ category: "導入のご相談", name: "山田 太郎" });
  });

  it("任意項目（ご所属・電話）が空なら undefined になり payload には空文字で残る", () => {
    const body = buildContactIntakeBody({ ...FULL, org: "", phone: "" }, "その他");
    expect(body.applicant_org).toBeUndefined();
    expect(body.applicant_phone).toBeUndefined();
    expect(body.payload).toMatchObject({ org: "", phone: "" });
  });

  it("生成したボディはサーバー側スキーマ（applicationIntakeSchema）を通過する", () => {
    const body = buildContactIntakeBody(FULL, "サービスについて");
    expect(applicationIntakeSchema.safeParse(body).success).toBe(true);
    const empty = buildContactIntakeBody({ ...FULL, org: "", phone: "" }, "その他");
    expect(applicationIntakeSchema.safeParse(empty).success).toBe(true);
  });

  it("contactFormSchema と組み合わせて使える（検証済み値の受け渡し）", () => {
    const parsed = contactFormSchema.safeParse(FULL);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const body = buildContactIntakeBody(parsed.data, "取材・提携");
      expect(body.source).toBe("contact");
    }
  });
});
