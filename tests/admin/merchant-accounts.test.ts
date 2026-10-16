import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accountStatusOf, buildPasswordSetupMail, createPasswordSetupLink } from "@/lib/admin/merchant-accounts";

const NOW = new Date("2026-10-16T00:00:00Z");

describe("accountStatusOf", () => {
  it("停止中（banned_until が未来）／利用中（ログイン実績あり）／招待中", () => {
    expect(accountStatusOf({ last_sign_in_at: "2026-10-01T00:00:00Z", banned_until: "2126-01-01T00:00:00Z" }, NOW)).toBe("suspended");
    expect(accountStatusOf({ last_sign_in_at: "2026-10-01T00:00:00Z", banned_until: "2026-10-01T00:00:00Z" }, NOW)).toBe("active");
    expect(accountStatusOf({ last_sign_in_at: undefined }, NOW)).toBe("invited");
  });
});

describe("buildPasswordSetupMail", () => {
  it("UD Payment 利用者は UD Payment 名義、初回か再設定かで書き出しを変える", () => {
    const first = buildPasswordSetupMail({ kind: "udpay", displayName: "永村", link: "https://x", firstTime: true });
    expect(first.subject).toBe("【UD Payment】パスワード設定のご案内");
    expect(first.text).toContain("あらためてお送りします");
    const reset = buildPasswordSetupMail({ kind: "provider", displayName: "山田", link: "https://x", firstTime: false });
    expect(reset.subject).toBe("【QOLC】パスワード設定のご案内");
    expect(reset.text).toContain("パスワード再設定のご依頼");
  });
});

describe("createPasswordSetupLink", () => {
  it("メール未確認（招待の期限切れ）は確認済みにしてから再設定リンクを作る", async () => {
    const updateUserById = vi.fn(async () => ({ error: null }));
    const generateLink = vi.fn(async () => ({ data: { properties: { action_link: "https://link" } }, error: null }));
    const client = {
      auth: { admin: { getUserById: async () => ({ data: { user: { email: "a@x.jp", email_confirmed_at: null } } }), updateUserById, generateLink } },
    } as unknown as SupabaseClient;
    expect(await createPasswordSetupLink(client, "u1", "https://app.qolc.jp/")).toEqual({ ok: true, email: "a@x.jp", link: "https://link" });
    expect(updateUserById).toHaveBeenCalledWith("u1", { email_confirm: true });
    expect(generateLink).toHaveBeenCalledWith({ type: "recovery", email: "a@x.jp", options: { redirectTo: "https://app.qolc.jp/set-password" } });
  });
});
