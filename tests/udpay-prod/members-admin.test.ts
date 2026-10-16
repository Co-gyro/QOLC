import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMemberInviteMail, inviteMember } from "@/lib/udpay/prod/members-admin";
import { fakeSupabase, type FakeTables } from "../helpers/fake-supabase";

describe("buildMemberInviteMail", () => {
  it("UD Payment 名義で、権限と2回目以降のログイン先を書く", () => {
    const m = buildMemberInviteMail({ displayName: "永村 隆司", merchantName: "株式会社ランサイド", isApprover: true, inviteUrl: "https://x/invite" });
    expect(m.subject).toBe("【UD Payment】ログインアカウント発行のご案内");
    expect(m.text).toContain("永村 隆司 様");
    expect(m.text).toContain("承認者");
    expect(m.text).toContain("https://app.qolc.jp/login");
    expect(m.text).toContain("https://x/invite");
  });
});

/** auth.admin を持つ Supabase の偽物 */
function client(tables: FakeTables, linkOk = true) {
  const deleteUser = vi.fn(async () => ({ error: null }));
  const createUser = vi.fn(async () => ({ data: { user: { id: "u-new" } }, error: null }));
  const c = Object.assign(fakeSupabase(tables), {
    auth: {
      admin: {
        createUser,
        deleteUser,
        generateLink: vi.fn(async () => (linkOk ? { data: { properties: { action_link: "https://x/invite" } }, error: null } : { data: null, error: { message: "ng" } })),
      },
    },
  }) as unknown as SupabaseClient;
  return { c, createUser, deleteUser };
}

const INPUT = { merchantId: "3f4c3935-fc27-4721-b2d6-8d6f56aec41d", displayName: "永村", email: "n@runside.example", isApprover: true };

describe("inviteMember", () => {
  it("role=udpay_merchant で作り、profiles と udpay_members を登録して招待リンクを返す", async () => {
    const t: FakeTables = { profiles: [], udpay_members: [] };
    const { c, createUser } = client(t);
    const r = await inviteMember(c, INPUT, "https://app.qolc.jp");
    expect(r).toEqual({ ok: true, userId: "u-new", inviteUrl: "https://x/invite" });
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ app_metadata: { role: "udpay_merchant" } }));
    expect(t.profiles[0]).toMatchObject({ id: "u-new", role: "udpay_merchant" });
    expect(t.udpay_members[0]).toMatchObject({ user_id: "u-new", is_approver: true });
  });
  it("招待リンクを作れなければ作ったユーザーを消して失敗を返す", async () => {
    const { c, deleteUser } = client({ profiles: [], udpay_members: [] }, false);
    const r = await inviteMember(c, INPUT, "https://app.qolc.jp");
    expect(r.ok).toBe(false);
    expect(deleteUser).toHaveBeenCalledWith("u-new");
  });
});
