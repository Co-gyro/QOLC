import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildChargeNotice, notifyChargeResults } from "@/lib/udpay/prod/charge-notify";
import { fakeSupabase } from "../helpers/fake-supabase";

describe("buildChargeNotice", () => {
  const base = { merchantName: "株式会社ランサイド", today: "2026-10-28", billingUrl: "https://app.qolc.jp/billing/payments" };
  it("与信落ちがあれば件名で知らせ、再決済の手順を書く", () => {
    const n = buildChargeNotice({
      ...base,
      lines: [
        { customerName: "さくら歯科", serviceMonth: "2026-10", amount: 11000, outcome: "captured" },
        { customerName: "みなと歯科", serviceMonth: "2026-10", amount: 22000, outcome: "failed", error: "カード会社の承認が得られませんでした（code=02）" },
      ],
    });
    expect(n.subject).toBe("【UD Payment】与信落ちが1件あります（2026年10月28日の自動課金）");
    expect(n.text).toContain("■ 入金済み 1件・¥11,000");
    expect(n.text).toContain("・みなと歯科（2026年10月分）¥22,000　カード会社の承認が得られませんでした（code=02）");
    expect(n.text).toContain("「再決済」");
  });
  it("全件成功なら件数だけの件名", () => {
    const n = buildChargeNotice({ ...base, lines: [{ customerName: "A", serviceMonth: "2026-10", amount: 100, outcome: "captured" }] });
    expect(n.subject).toBe("【UD Payment】2026年10月28日の自動課金結果（入金済み1件）");
    expect(n.text).not.toContain("与信落ち");
  });
});

describe("notifyChargeResults", () => {
  it("加盟店の利用者（*.test は除く）と UD に送り、与信落ちの日は送付履歴を残す", async () => {
    const tables = {
      udpay_payments: [{ id: "p1", merchant_id: "m1", amount: 22000, udpay_customers: { name: "みなと歯科" }, udpay_invoices: { service_month: "2026-10" } }],
      udpay_merchant_settings: [{ merchant_id: "m1", display_name: "株式会社ランサイド", reply_to: null }],
      udpay_members: [
        { merchant_id: "m1", user_id: "u1", deleted_at: null },
        { merchant_id: "m1", user_id: "u2", deleted_at: null },
      ],
      udpay_mail_logs: [] as Record<string, unknown>[],
    };
    const client = Object.assign(fakeSupabase(tables), {
      auth: {
        admin: {
          getUserById: async (id: string) => ({ data: { user: { email: id === "u1" ? "nagamura@runside.example" : "udpay-staff@qolc.test" } } }),
        },
      },
    }) as unknown as SupabaseClient;
    const send = vi.fn(async () => ({ sent: true, skipped: false, id: "re_1" }));
    const r = await notifyChargeResults(client, [{ paymentId: "p1", outcome: "failed", error: "code=02" }], "2026-10-28", "https://app.qolc.jp", send);
    expect(r).toEqual({ merchants: 1, udSent: true });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ["nagamura@runside.example"] }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "support@uni-dev.jp" }));
    expect(tables.udpay_mail_logs[0]).toMatchObject({ kind: "payment_failed", status: "sent" });
  });
  it("課金がなければ何も送らない", async () => {
    const send = vi.fn();
    expect(await notifyChargeResults(fakeSupabase({}), [], "2026-10-28", "https://app.qolc.jp", send)).toEqual({ merchants: 0, udSent: false });
    expect(send).not.toHaveBeenCalled();
  });
});
