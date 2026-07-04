import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/** モック共有状態（vi.mock はホイストされるため vi.hoisted で先に確保する）。 */
const state = vi.hoisted(() => ({
  /** applications への insert 内容 */
  insertedApplications: [] as Array<Record<string, unknown>>,
  /** application_events への insert 内容 */
  insertedEvents: [] as Array<Record<string, unknown>>,
  /** applications insert を失敗させるか */
  failInsert: false,
  /** sendEmail の呼び出し */
  emailCalls: [] as Array<{ to: string; subject: string; text: string }>,
  /** sendEmail の戻り値 */
  emailResult: { sent: false, skipped: true } as {
    sent: boolean;
    skipped: boolean;
    error?: string;
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (table === "applications") {
          state.insertedApplications.push(row);
          return {
            select: () => ({
              single: async () =>
                state.failInsert
                  ? { data: null, error: { message: "insert failed" } }
                  : { data: { id: "app-0001-uuid" }, error: null },
            }),
          };
        }
        // application_events（await される）
        state.insertedEvents.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: async (input: { to: string; subject: string; text: string }) => {
    state.emailCalls.push(input);
    return state.emailResult;
  },
}));

import { POST } from "@/app/api/applications/route";

/** テスト用リクエストを生成する（IPをテストごとに変えてレートリミット干渉を防ぐ）。 */
function makeReq(body: unknown, ip: string): NextRequest {
  return new Request("http://localhost/api/applications", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  state.insertedApplications.length = 0;
  state.insertedEvents.length = 0;
  state.emailCalls.length = 0;
  state.failInsert = false;
  state.emailResult = { sent: false, skipped: true };
});

describe("POST /api/applications", () => {
  it("source=contact を受け付け、created と email_sent イベントを記録する", async () => {
    state.emailResult = { sent: true, skipped: false };
    const res = await POST(
      makeReq(
        {
          source: "contact",
          applicant_name: "山田 太郎",
          applicant_email: "taro@example.com",
          message: "問い合わせです",
          payload: { category: "サービスについて" },
        },
        "10.0.0.1"
      )
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { id: string } };
    expect(json.success).toBe(true);
    expect(json.data.id).toBe("app-0001-uuid");

    expect(state.insertedApplications[0]).toMatchObject({ source: "contact" });
    const kinds = state.insertedEvents.map((e) => e.kind);
    expect(kinds).toEqual(["created", "email_sent"]);
    const emailEvent = state.insertedEvents[1];
    expect(emailEvent?.detail).toMatchObject({
      to: "ta***@example.com",
      template: "application_received",
      sent: true,
    });
    expect(state.emailCalls[0]?.to).toBe("taro@example.com");
  });

  it("既存の qolc_merchant 受付は従来どおり成功する（回帰）＋自動返信も送る", async () => {
    const res = await POST(
      makeReq(
        {
          source: "qolc_merchant",
          applicant_name: "佐藤 花子",
          applicant_email: "hanako@example.com",
          payload: { corpName: "株式会社サンプル" },
        },
        "10.0.0.2"
      )
    );
    expect(res.status).toBe(200);
    expect(state.emailCalls).toHaveLength(1);
    expect(state.insertedEvents.map((e) => e.kind)).toEqual(["created", "email_sent"]);
  });

  it("applicant_email がなければメール送信しない（created のみ）", async () => {
    const res = await POST(
      makeReq({ source: "jcb_consult", applicant_name: "匿名", payload: {} }, "10.0.0.3")
    );
    expect(res.status).toBe(200);
    expect(state.emailCalls).toHaveLength(0);
    expect(state.insertedEvents.map((e) => e.kind)).toEqual(["created"]);
  });

  it("メール送信が失敗（sent:false, error）でも受付は成功として返す", async () => {
    state.emailResult = { sent: false, skipped: false, error: "Resend API error 500" };
    const res = await POST(
      makeReq(
        { source: "contact", applicant_email: "err@example.com", message: "x" },
        "10.0.0.4"
      )
    );
    expect(res.status).toBe(200);
    const emailEvent = state.insertedEvents.find((e) => e.kind === "email_sent");
    expect(emailEvent?.detail).toMatchObject({ sent: false, skipped: false });
  });

  it("不正な source は 400（VALIDATION_ERROR）", async () => {
    const res = await POST(makeReq({ source: "hacker" }, "10.0.0.5"));
    expect(res.status).toBe(400);
    expect(state.insertedApplications).toHaveLength(0);
  });

  it("DB insert 失敗時は 500 でメールも送らない", async () => {
    state.failInsert = true;
    const res = await POST(
      makeReq({ source: "contact", applicant_email: "x@example.com" }, "10.0.0.6")
    );
    expect(res.status).toBe(500);
    expect(state.emailCalls).toHaveLength(0);
  });
});
