import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  maskEmail,
  sendApplicationReceivedEmail,
} from "@/lib/applications/intake-email";
import type { SendEmailInput, SendEmailResult, sendEmail } from "@/lib/email/send";

/** application_events への insert を捕捉するフェイク admin クライアント。 */
function fakeAdmin(captured: unknown[], failInsert = false): SupabaseClient {
  return {
    from: (table: string) => ({
      insert: async (row: unknown) => {
        if (failInsert) throw new Error("db down");
        captured.push({ table, row });
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
}

/** 固定結果を返す注入用送信関数。 */
function fakeSend(result: SendEmailResult, calls: SendEmailInput[]): typeof sendEmail {
  return (async (input: SendEmailInput) => {
    calls.push(input);
    return result;
  }) as typeof sendEmail;
}

describe("maskEmail", () => {
  it("先頭2文字＋***＋@ドメイン にマスクする", () => {
    expect(maskEmail("taro@example.com")).toBe("ta***@example.com");
  });

  it("ローカル部が2文字以下でも壊れない", () => {
    expect(maskEmail("a@example.com")).toBe("a***@example.com");
  });

  it("@ がない・不正な形式は *** を返す", () => {
    expect(maskEmail("not-an-email")).toBe("***");
    expect(maskEmail("@example.com")).toBe("***");
  });
});

describe("sendApplicationReceivedEmail", () => {
  const PARAMS = {
    applicationId: "11111111-2222-3333-4444-555555555555",
    source: "contact" as const,
    applicantName: "山田 太郎",
    to: "taro@example.com",
  };

  it("送信して結果を email_sent イベントとして記録する（宛先はマスク）", async () => {
    const events: Array<{ table: string; row: Record<string, unknown> }> = [];
    const calls: SendEmailInput[] = [];
    const result = await sendApplicationReceivedEmail(
      fakeAdmin(events as unknown[]),
      PARAMS,
      fakeSend({ sent: true, skipped: false, id: "email_1" }, calls)
    );
    expect(result.sent).toBe(true);
    expect(calls[0]?.to).toBe("taro@example.com");
    expect(calls[0]?.subject).toContain("お問い合わせ");
    expect(calls[0]?.text).toContain("山田 太郎 様");
    expect(calls[0]?.text).toContain(PARAMS.applicationId); // 受付番号
    expect(events).toHaveLength(1);
    expect(events[0]?.table).toBe("application_events");
    expect(events[0]?.row).toMatchObject({
      application_id: PARAMS.applicationId,
      actor_id: null,
      kind: "email_sent",
    });
    const detail = events[0]?.row.detail as Record<string, unknown>;
    expect(detail.to).toBe("ta***@example.com"); // 生アドレスは保存しない
    expect(detail).toMatchObject({ template: "application_received", sent: true, skipped: false });
  });

  it("スキップ（RESEND_API_KEY未設定相当）でもイベントに skipped:true を記録する", async () => {
    const events: Array<{ table: string; row: Record<string, unknown> }> = [];
    const result = await sendApplicationReceivedEmail(
      fakeAdmin(events as unknown[]),
      PARAMS,
      fakeSend({ sent: false, skipped: true }, [])
    );
    expect(result).toEqual({ sent: false, skipped: true });
    const detail = events[0]?.row.detail as Record<string, unknown>;
    expect(detail).toMatchObject({ sent: false, skipped: true });
  });

  it("送信失敗時は error をイベントに含める", async () => {
    const events: Array<{ table: string; row: Record<string, unknown> }> = [];
    await sendApplicationReceivedEmail(
      fakeAdmin(events as unknown[]),
      PARAMS,
      fakeSend({ sent: false, skipped: false, error: "Resend API error 422" }, [])
    );
    const detail = events[0]?.row.detail as Record<string, unknown>;
    expect(detail.error).toBe("Resend API error 422");
  });

  it("送信関数が万一 throw しても throw せず失敗結果を返す", async () => {
    const events: unknown[] = [];
    const boom = (async () => {
      throw new Error("boom");
    }) as unknown as typeof sendEmail;
    const result = await sendApplicationReceivedEmail(fakeAdmin(events), PARAMS, boom);
    expect(result.sent).toBe(false);
    expect(result.error).toBe("boom");
    expect(events).toHaveLength(1); // 失敗も記録される
  });

  it("イベント記録が失敗しても throw しない", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await sendApplicationReceivedEmail(
      fakeAdmin([], true),
      PARAMS,
      fakeSend({ sent: true, skipped: false }, [])
    );
    expect(result.sent).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
