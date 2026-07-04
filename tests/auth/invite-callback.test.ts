import { describe, expect, it } from "vitest";
import {
  describeCallbackError,
  parseAuthCallbackHash,
} from "../../src/lib/auth/invite-callback";
import { ROLE_HOME } from "../../src/lib/auth/role-home";

describe("parseAuthCallbackHash", () => {
  it("トークン付きハッシュから access_token / refresh_token を取り出す", () => {
    const result = parseAuthCallbackHash(
      "#access_token=aaa.bbb.ccc&refresh_token=rrr&token_type=bearer&type=invite"
    );
    expect(result).toEqual({
      kind: "tokens",
      accessToken: "aaa.bbb.ccc",
      refreshToken: "rrr",
    });
  });

  it("先頭に # がなくても解析できる", () => {
    const result = parseAuthCallbackHash("access_token=a&refresh_token=r");
    expect(result.kind).toBe("tokens");
  });

  it("期限切れエラーは日本語の再発行案内になる", () => {
    const result = parseAuthCallbackHash(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("再発行");
    }
  });

  it("空ハッシュ・トークン欠落は none を返す", () => {
    expect(parseAuthCallbackHash("").kind).toBe("none");
    expect(parseAuthCallbackHash("#access_token=only").kind).toBe("none");
    expect(parseAuthCallbackHash("#type=invite").kind).toBe("none");
  });
});

describe("describeCallbackError", () => {
  it("expired を含む説明は期限切れ文言になる", () => {
    expect(describeCallbackError("access_denied", "Email link is invalid or has expired")).toContain(
      "有効期限"
    );
  });

  it("説明なしの access_denied は確認不可の文言になる", () => {
    expect(describeCallbackError("access_denied", null)).toContain("確認できません");
  });

  it("未知のエラーコードは汎用文言になる", () => {
    expect(describeCallbackError("server_error", null)).toContain("認証エラー");
  });
});

describe("ROLE_HOME", () => {
  it("全ロールに遷移先が定義されている", () => {
    expect(ROLE_HOME.admin).toBe("/admin/dashboard");
    expect(ROLE_HOME.facility_staff).toBe("/facility/dashboard");
    expect(ROLE_HOME.provider).toBe("/provider/dashboard");
    expect(ROLE_HOME.family).toBe("/user/home");
  });
});
