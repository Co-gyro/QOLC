/**
 * payment-queries（決済一覧取得・集計）のテスト
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ブラウザ Supabase クライアントをモック
const mockState: { rows: unknown[]; error: unknown; lastEq?: [string, unknown] } = {
  rows: [],
  error: null,
};
vi.mock("../../src/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    from() {
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        eq: (col: string, val: unknown) => {
          mockState.lastEq = [col, val];
          return chain;
        },
        then: (resolve: (r: { data: unknown[]; error: unknown }) => void) =>
          resolve({ data: mockState.rows, error: mockState.error }),
      };
      return chain;
    },
  }),
}));

import {
  fetchPayments,
  summarizePayments,
  type PaymentListRow,
} from "../../src/lib/portal/payment-queries";

describe("summarizePayments", () => {
  const rows: PaymentListRow[] = [
    { id: "1", date: "2026-05-27", residentName: "A", merchantName: "M", amount: 5000, status: "pending", jutyuCd: null },
    { id: "2", date: "2026-05-27", residentName: "B", merchantName: "M", amount: 3000, status: "pending", jutyuCd: null },
    { id: "3", date: "2026-05-27", residentName: "C", merchantName: "M", amount: 8000, status: "captured", jutyuCd: "TSJM-0000001" },
  ];

  it("件数・合計・ステータス別を集計", () => {
    const s = summarizePayments(rows);
    expect(s.total).toBe(3);
    expect(s.totalAmount).toBe(16000);
    expect(s.byStatus["pending"]).toEqual({ count: 2, amount: 8000 });
    expect(s.byStatus["captured"]).toEqual({ count: 1, amount: 8000 });
  });

  it("空配列", () => {
    const s = summarizePayments([]);
    expect(s).toEqual({ total: 0, totalAmount: 0, byStatus: {} });
  });
});

describe("fetchPayments", () => {
  beforeEach(() => {
    mockState.rows = [];
    mockState.error = null;
    mockState.lastEq = undefined;
  });

  it("埋め込み結果を表示行にマッピング", async () => {
    mockState.rows = [
      {
        id: "p1",
        total_amount: 5000,
        payment_status: "pending",
        usen_jutyu_cd: null,
        created_at: "2026-05-27T10:00:00Z",
        residents: { name_last: "山田", name_first: "テスト" },
        merchants: { name: "テスト診療所" },
      },
    ];
    const rows = await fetchPayments();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "p1",
      date: "2026-05-27",
      residentName: "山田 テスト",
      merchantName: "テスト診療所",
      amount: 5000,
      status: "pending",
    });
  });

  it("residents/merchants が null でも (不明) で安全に処理", async () => {
    mockState.rows = [
      {
        id: "p2",
        total_amount: null,
        payment_status: "failed",
        usen_jutyu_cd: null,
        created_at: "2026-05-27T10:00:00Z",
        residents: null,
        merchants: null,
      },
    ];
    const rows = await fetchPayments();
    expect(rows[0].residentName).toBe("(不明)");
    expect(rows[0].merchantName).toBe("(不明)");
    expect(rows[0].amount).toBe(0);
  });

  it("status 指定時は eq で絞り込む", async () => {
    await fetchPayments("captured");
    expect(mockState.lastEq).toEqual(["payment_status", "captured"]);
  });

  it("error 時は例外", async () => {
    mockState.error = { message: "RLS denied" };
    await expect(fetchPayments()).rejects.toThrow(/RLS denied/);
  });
});
