import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmail } from "@/lib/email/send";

/** fetch をモックするヘルパー（line/verify-remote.test.ts と同様式） */
function mockFetch(
  status: number,
  body: unknown,
  capture?: (url: string, init: RequestInit) => void
) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    capture?.(String(url), init ?? {});
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
}

const ORIGINAL_KEY = process.env.RESEND_API_KEY;
const ORIGINAL_FROM = process.env.EMAIL_FROM;
const ORIGINAL_REPLY_TO = process.env.EMAIL_REPLY_TO;

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.EMAIL_REPLY_TO;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_KEY;
  if (ORIGINAL_FROM === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = ORIGINAL_FROM;
  if (ORIGINAL_REPLY_TO === undefined) delete process.env.EMAIL_REPLY_TO;
  else process.env.EMAIL_REPLY_TO = ORIGINAL_REPLY_TO;
  vi.restoreAllMocks();
});

const INPUT = { to: "test@example.com", subject: "件名", text: "本文" };

describe("sendEmail", () => {
  it("RESEND_API_KEY 未設定なら送信せずスキップする（throwしない）", async () => {
    const f = vi.fn();
    const result = await sendEmail(INPUT, f as unknown as typeof fetch);
    expect(result).toEqual({ sent: false, skipped: true });
    expect(f).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("キー設定時は Resend API へ POST し、成功なら sent=true", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    let capturedUrl = "";
    let capturedInit: RequestInit = {};
    const f = mockFetch(200, { id: "email_123" }, (url, init) => {
      capturedUrl = url;
      capturedInit = init;
    });
    const result = await sendEmail(INPUT, f);
    expect(result).toEqual({ sent: true, skipped: false, id: "email_123" });
    expect(capturedUrl).toBe("https://api.resend.com/emails");
    expect((capturedInit.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_test_key"
    );
    const body = JSON.parse(String(capturedInit.body)) as Record<string, unknown>;
    expect(body.to).toEqual(["test@example.com"]);
    expect(body.subject).toBe("件名");
    // 既定の差出人＝返信可能な統一アドレス（qolc.jp は MX を持たない）
    expect(body.from).toBe("QOLC（コルク）運営事務局 <support@uni-dev.jp>");
    expect(body.reply_to).toBe("support@uni-dev.jp");
  });

  it("fromName で表示名だけを差し替え、アドレスは EMAIL_FROM のものを保つ", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    let body: Record<string, unknown> = {};
    const f = mockFetch(200, { id: "x" }, (_u, init) => {
      body = JSON.parse(String(init.body)) as Record<string, unknown>;
    });
    await sendEmail({ ...INPUT, fromName: "株式会社ユニバーサル・デベロップメント" }, f);
    expect(body.from).toBe("株式会社ユニバーサル・デベロップメント <support@uni-dev.jp>");
    expect(body.reply_to).toBe("support@uni-dev.jp");
  });

  it("EMAIL_REPLY_TO で返信先を上書きできる", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_REPLY_TO = "ops@uni-dev.jp";
    let replyTo = "";
    const f = mockFetch(200, { id: "x" }, (_u, init) => {
      replyTo = (JSON.parse(String(init.body)) as { reply_to: string }).reply_to;
    });
    await sendEmail(INPUT, f);
    expect(replyTo).toBe("ops@uni-dev.jp");
    delete process.env.EMAIL_REPLY_TO;
  });

  it("EMAIL_FROM 環境変数で差出人を上書きできる", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "QOLC運営 <ops@qolc.jp>";
    let from = "";
    const f = mockFetch(200, { id: "x" }, (_u, init) => {
      from = (JSON.parse(String(init.body)) as { from: string }).from;
    });
    await sendEmail(INPUT, f);
    expect(from).toBe("QOLC運営 <ops@qolc.jp>");
  });

  it("APIエラー（4xx/5xx）でも throw せずエラー内容を返す", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const f = mockFetch(422, { message: "Invalid to address" });
    const result = await sendEmail(INPUT, f);
    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.error).toContain("422");
    expect(result.error).toContain("Invalid to address");
  });

  it("ネットワーク例外でも throw せずエラー内容を返す", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const f = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const result = await sendEmail(INPUT, f);
    expect(result).toEqual({ sent: false, skipped: false, error: "network down" });
  });
});
