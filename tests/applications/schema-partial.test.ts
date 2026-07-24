/**
 * merchantApplyFormBaseSchema.partial()（admin の申請内容編集用）のテスト
 * 段階的な入力を許容しつつ、入力済み項目の形式は検証することを保証する。
 */
import { describe, it, expect } from "vitest";

import {
  merchantApplyFormBaseSchema,
  merchantApplyFormSchema,
} from "@/lib/applications/schema";

describe("merchantApplyFormBaseSchema.partial()", () => {
  const partial = merchantApplyFormBaseSchema.partial();

  it("一部の項目だけでも通る（手動起票の段階入力）", () => {
    expect(partial.safeParse({ corpName: "株式会社サンプル" }).success).toBe(true);
    expect(partial.safeParse({}).success).toBe(true);
  });

  it("入力済み項目の形式エラーは弾く", () => {
    expect(partial.safeParse({ phone: "12345" }).success).toBe(false);
    expect(partial.safeParse({ corpNameKana: "かな" }).success).toBe(false);
    expect(partial.safeParse({ postalCode: "abc" }).success).toBe(false);
  });

  it("公開フォーム用スキーマ（全必須）は分割後も従来どおり動く（回帰）", () => {
    expect(merchantApplyFormSchema.safeParse({ corpName: "だけ" }).success).toBe(false);
  });
});
