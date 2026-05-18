/**
 * audit-log の maskSensitive 単体テスト
 */
import { describe, it, expect } from "vitest";
import { maskSensitive, logPaymentAudit } from "../../src/lib/payment/audit-log";

describe("maskSensitive", () => {
  it("プリミティブはそのまま返す", () => {
    expect(maskSensitive("hello")).toBe("hello");
    expect(maskSensitive(42)).toBe(42);
    expect(maskSensitive(true)).toBe(true);
    expect(maskSensitive(null)).toBe(null);
    expect(maskSensitive(undefined)).toBe(undefined);
  });

  it("通常のフィールドはそのまま", () => {
    expect(maskSensitive({ a: 1, b: "x", c: null })).toEqual({ a: 1, b: "x", c: null });
  });

  it("card_no / cardNo / card_number をマスク", () => {
    expect(maskSensitive({ card_no: "4111111111111111" })).toEqual({ card_no: "***" });
    expect(maskSensitive({ cardNo: "4111111111111111" })).toEqual({ cardNo: "***" });
    expect(maskSensitive({ card_number: "4111-..." })).toEqual({ card_number: "***" });
  });

  it("cvv, cvc, expiry, security_code もマスク", () => {
    expect(maskSensitive({ cvv: "123" })).toEqual({ cvv: "***" });
    expect(maskSensitive({ cvc: "456" })).toEqual({ cvc: "***" });
    expect(maskSensitive({ expiry: "2030/12" })).toEqual({ expiry: "***" });
    expect(maskSensitive({ security_code: "999" })).toEqual({ security_code: "***" });
  });

  it("hmac, secret, password, token, api_key もマスク", () => {
    expect(maskSensitive({ hmac_key: "deadbeef" })).toEqual({ hmac_key: "***" });
    expect(maskSensitive({ secret: "x" })).toEqual({ secret: "***" });
    expect(maskSensitive({ password: "p" })).toEqual({ password: "***" });
    expect(maskSensitive({ access_token: "t" })).toEqual({ access_token: "***" });
    expect(maskSensitive({ api_key: "k" })).toEqual({ api_key: "***" });
  });

  it("再帰的にネストされたオブジェクトもマスク", () => {
    expect(
      maskSensitive({
        user: { id: "u1", password: "secret" },
        meta: { card_no: "4111" },
      })
    ).toEqual({
      user: { id: "u1", password: "***" },
      meta: { card_no: "***" },
    });
  });

  it("配列内のオブジェクトもマスク", () => {
    expect(
      maskSensitive({
        cards: [{ card_no: "4111" }, { card_no: "5555" }],
      })
    ).toEqual({
      cards: [{ card_no: "***" }, { card_no: "***" }],
    });
  });

  it("大文字小文字を区別せずにマッチ", () => {
    expect(maskSensitive({ CARD_NO: "x" })).toEqual({ CARD_NO: "***" });
    expect(maskSensitive({ Password: "x" })).toEqual({ Password: "***" });
  });
});

describe("logPaymentAudit（モッククライアント）", () => {
  it("payment_audit_logs に INSERT 呼び出しを行う（マスク済みボディで）", async () => {
    let insertedTable = "";
    let insertedRow: unknown = null;
    const mockClient = {
      from(table: string) {
        insertedTable = table;
        return {
          insert(row: unknown) {
            insertedRow = row;
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };

    const ok = await logPaymentAudit({
      paymentId: "p1",
      action: "auth_by_member_id",
      request: { amount: 1000, card_no: "4111" },
      response: { res_cd: "S" },
      performedBy: "user-1",
      ipAddress: "192.168.1.1",
      // SupabaseClient型と互換性のないモックだが、関数内では .from().insert() しか使われない
      client: mockClient as unknown as Parameters<typeof logPaymentAudit>[0]["client"],
    });

    expect(ok).toBe(true);
    expect(insertedTable).toBe("payment_audit_logs");
    const row = insertedRow as Record<string, unknown>;
    expect(row.payment_id).toBe("p1");
    expect(row.action).toBe("auth_by_member_id");
    expect(row.performed_by).toBe("user-1");
    expect(row.ip_address).toBe("192.168.1.1");
    // card_no はマスクされていること
    expect(row.request_body).toEqual({ amount: 1000, card_no: "***" });
  });

  it("insert エラーでも false を返してアプリは止めない", async () => {
    const mockClient = {
      from() {
        return {
          insert() {
            return Promise.resolve({
              data: null,
              error: { message: "RLS denied" },
            });
          },
        };
      },
    };
    const ok = await logPaymentAudit({
      action: "search_trade",
      request: { a: 1 },
      client: mockClient as unknown as Parameters<typeof logPaymentAudit>[0]["client"],
    });
    expect(ok).toBe(false);
  });
});
