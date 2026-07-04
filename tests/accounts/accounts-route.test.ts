import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/** モック共有状態。 */
const state = vi.hoisted(() => ({
  adminOk: true,
  targetRow: { id: "t", name: "サンプル施設" } as { id: string; name: string } | null,
  createUserError: null as { status?: number; message: string } | null,
  profileError: null as { message: string } | null,
  linkError: null as { message: string } | null,
  actionLink: "https://supabase.example.com/auth/v1/verify?token=abc&type=invite",
  emailResult: { sent: false, skipped: true } as { sent: boolean; skipped: boolean; error?: string },
  // 記録
  createUserCalls: [] as Array<Record<string, unknown>>,
  deletedUsers: [] as string[],
  upserts: [] as Array<Record<string, unknown>>,
  generateLinkCalls: [] as Array<Record<string, unknown>>,
  emailCalls: [] as Array<{ to: string; subject: string; text: string }>,
  activityLogs: [] as Array<Record<string, unknown>>,
  queriedTables: [] as string[],
}));

vi.mock("@/lib/applications/server", () => ({
  requireAdmin: async () =>
    state.adminOk
      ? { ok: true, user: { id: "admin-user-id" } }
      : { ok: false, message: "認証されていません", code: "UNAUTHORIZED", status: 401 },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    auth: {
      admin: {
        createUser: async (attrs: Record<string, unknown>) => {
          state.createUserCalls.push(attrs);
          if (state.createUserError) {
            return { data: { user: null }, error: state.createUserError };
          }
          return { data: { user: { id: "new-user-id" } }, error: null };
        },
        deleteUser: async (id: string) => {
          state.deletedUsers.push(id);
          return { data: {}, error: null };
        },
        generateLink: async (params: Record<string, unknown>) => {
          state.generateLinkCalls.push(params);
          if (state.linkError) return { data: { properties: null }, error: state.linkError };
          return { data: { properties: { action_link: state.actionLink } }, error: null };
        },
      },
    },
    from: (table: string) => {
      state.queriedTables.push(table);
      if (table === "profiles") {
        return {
          upsert: async (row: Record<string, unknown>) => {
            state.upserts.push(row);
            return { error: state.profileError };
          },
        };
      }
      // facilities / merchants の存在チェック
      return {
        select: () => ({
          eq: () => ({
            is: () => ({ maybeSingle: async () => ({ data: state.targetRow, error: null }) }),
          }),
        }),
      };
    },
  }),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: async (input: { to: string; subject: string; text: string }) => {
    state.emailCalls.push(input);
    return state.emailResult;
  },
}));

vi.mock("@/lib/audit/activity-log", () => ({
  logActivity: async (input: Record<string, unknown>) => {
    state.activityLogs.push(input);
  },
}));

import { POST } from "@/app/api/admin/accounts/route";

const FACILITY_ID = "11111111-1111-4111-8111-111111111111";
const MERCHANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** テスト用リクエストを生成する。 */
function makeReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/accounts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const FACILITY_BODY = {
  email: "staff@example.com",
  displayName: "山田 太郎",
  role: "facility_staff",
  facilityId: FACILITY_ID,
};

beforeEach(() => {
  state.adminOk = true;
  state.targetRow = { id: FACILITY_ID, name: "サンプル施設" };
  state.createUserError = null;
  state.profileError = null;
  state.linkError = null;
  state.emailResult = { sent: false, skipped: true };
  state.createUserCalls.length = 0;
  state.deletedUsers.length = 0;
  state.upserts.length = 0;
  state.generateLinkCalls.length = 0;
  state.emailCalls.length = 0;
  state.activityLogs.length = 0;
  state.queriedTables.length = 0;
});

describe("POST /api/admin/accounts", () => {
  it("施設スタッフを発行できる（profiles昇格・招待リンク・監査ログ・URL返却）", async () => {
    const res = await POST(makeReq(FACILITY_BODY));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { userId: string; inviteUrl: string; portalName: string; emailResult: { skipped: boolean } };
    };
    expect(json.success).toBe(true);
    expect(json.data.userId).toBe("new-user-id");
    expect(json.data.portalName).toBe("施設ポータル");
    expect(json.data.inviteUrl).toBe(state.actionLink); // skipped でもURLをコピー可能

    // createUser は email_confirm: false（確認は招待リンクで）
    expect(state.createUserCalls[0]).toMatchObject({
      email: "staff@example.com",
      email_confirm: false,
    });
    // profiles をロール・所属で昇格
    expect(state.upserts[0]).toMatchObject({
      id: "new-user-id",
      role: "facility_staff",
      facility_id: FACILITY_ID,
      merchant_id: null,
      display_name: "山田 太郎",
    });
    // 招待リンク生成
    expect(state.generateLinkCalls[0]).toMatchObject({ type: "invite", email: "staff@example.com" });
    // 案内メール（skippedでも呼び出しはされる）
    expect(state.emailCalls[0]?.subject).toContain("施設ポータル");
    // 監査ログ
    expect(state.activityLogs[0]).toMatchObject({
      actorId: "admin-user-id",
      action: "account_create",
      facilityId: FACILITY_ID,
      targetId: "new-user-id",
    });
  });

  it("提供者（provider）は merchants を確認し merchant_id を設定する", async () => {
    state.targetRow = { id: MERCHANT_ID, name: "サンプル薬局" };
    const res = await POST(
      makeReq({
        email: "clinic@example.com",
        displayName: "薬局 担当",
        role: "provider",
        merchantId: MERCHANT_ID,
      })
    );
    expect(res.status).toBe(200);
    expect(state.queriedTables).toContain("merchants");
    expect(state.upserts[0]).toMatchObject({
      role: "provider",
      facility_id: null,
      merchant_id: MERCHANT_ID,
    });
    const json = (await res.json()) as { data: { portalName: string } };
    expect(json.data.portalName).toBe("提供者ポータル");
  });

  it("メール重複（既存ユーザー）は 409 と日本語メッセージ", async () => {
    state.createUserError = {
      status: 422,
      message: "A user with this email address has already been registered",
    };
    const res = await POST(makeReq(FACILITY_BODY));
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("このメールアドレスは既に登録されています");
  });

  it("認証NGなら 401 で何も作らない", async () => {
    state.adminOk = false;
    const res = await POST(makeReq(FACILITY_BODY));
    expect(res.status).toBe(401);
    expect(state.createUserCalls).toHaveLength(0);
  });

  it("facility_staff で facilityId 欠落は 400", async () => {
    const res = await POST(
      makeReq({ email: "a@example.com", displayName: "x", role: "facility_staff" })
    );
    expect(res.status).toBe(400);
  });

  it("所属施設が見つからなければ 404", async () => {
    state.targetRow = null;
    const res = await POST(makeReq(FACILITY_BODY));
    expect(res.status).toBe(404);
    expect(state.createUserCalls).toHaveLength(0);
  });

  it("招待リンク生成失敗時は作成ユーザーを削除して 500（リトライ可能に）", async () => {
    state.linkError = { message: "link failed" };
    const res = await POST(makeReq(FACILITY_BODY));
    expect(res.status).toBe(500);
    expect(state.deletedUsers).toEqual(["new-user-id"]);
    expect(state.emailCalls).toHaveLength(0);
  });

  it("profiles 更新失敗時も作成ユーザーを削除して 500", async () => {
    state.profileError = { message: "profile failed" };
    const res = await POST(makeReq(FACILITY_BODY));
    expect(res.status).toBe(500);
    expect(state.deletedUsers).toEqual(["new-user-id"]);
  });
});
