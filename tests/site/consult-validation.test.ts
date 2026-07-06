/**
 * consult-validation（住み替え相談フォームの必須チェック）のテスト
 */
import { describe, it, expect } from "vitest";

import { validateConsultPayload } from "@/lib/site/consult-validation";

describe("validateConsultPayload", () => {
  const valid = {
    timing: "半年以内",
    concerns: "シニアレジデンス（住まい）を探している",
    contact_method: "メール",
  };

  it("必須3項目が揃っていればエラーなし", () => {
    expect(validateConsultPayload(valid)).toEqual([]);
  });

  it("検討時期・お困りごと・連絡方法の欠落をそれぞれ検出する", () => {
    const errors = validateConsultPayload({});
    expect(errors).toHaveLength(3);
    expect(errors.join("")).toContain("検討時期");
    expect(errors.join("")).toContain("お困りごと");
    expect(errors.join("")).toContain("連絡方法");
  });

  it("空文字・非文字列は未入力扱い", () => {
    expect(validateConsultPayload({ ...valid, timing: "  " })).toHaveLength(1);
    expect(validateConsultPayload({ ...valid, concerns: 1 })).toHaveLength(1);
  });
});
