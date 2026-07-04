import { describe, expect, it } from "vitest";

import { validateCardCodes } from "@/app/admin/merchants/_lib/card-codes";

describe("validateCardCodes（加盟店番号のクライアント検証）", () => {
  it("すべて null / 空は許容する（未発番の状態）", () => {
    expect(validateCardCodes({ jcbRecurring: null, jcbEc: null, saison: null })).toBeNull();
  });

  it("正しい桁数の半角数字は許容する", () => {
    expect(
      validateCardCodes({
        jcbRecurring: "12345678901234567",
        jcbEc: "1234567890",
        saison: "2077247",
      })
    ).toBeNull();
  });

  it("JCB 登録型: 18桁以上・数字以外はエラー", () => {
    expect(
      validateCardCodes({ jcbRecurring: "123456789012345678", jcbEc: null, saison: null })
    ).toMatch(/登録型/);
    expect(
      validateCardCodes({ jcbRecurring: "12a", jcbEc: null, saison: null })
    ).toMatch(/半角数字/);
  });

  it("JCB 都度型EC: 18桁以上はエラー", () => {
    expect(
      validateCardCodes({ jcbRecurring: null, jcbEc: "123456789012345678", saison: null })
    ).toMatch(/都度型EC/);
  });

  it("セゾン: 8桁以上はエラー", () => {
    expect(validateCardCodes({ jcbRecurring: null, jcbEc: null, saison: "12345678" })).toMatch(
      /セゾン/
    );
  });
});
