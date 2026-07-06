import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** ISO(yyyy-mm-...) から「2026年6月」表記を作る（TZ非依存） */
function toMonthLabel(iso: string | null): string {
  if (!iso) return "";
  const [y, m] = iso.slice(0, 7).split("-");
  return `${y}年${Number(m)}月`;
}

/** 決済ステータスの表示ラベルと色 */
const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  captured: { label: "決済済み", bg: "#DCFCE7", fg: "#166534" },
  refunded: { label: "返金済み", bg: "#FEF3C7", fg: "#92400E" },
  authorized: { label: "決済処理中", bg: "#DBEAFE", fg: "#1E40AF" },
  pending: { label: "決済前", bg: "#F3F4F6", fg: "#374151" },
  failed: { label: "決済エラー", bg: "#FEE2E2", fg: "#991B1B" },
};

interface LineRow {
  payment_id: string | null;
  service_name: string | null;
  self_pay_amount: number | null;
  cost_kind: string | null;
}

/**
 * ユーザーポータル ご利用明細。
 * 自分（担当入居者）の決済を RLS（family read）経由で取得し、
 * 決済ごとに明細行（保険内サービス／その他費用）を月表示でまとめる。
 */
export default async function UserStatementsPage() {
  const supabase = createSupabaseServerClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("id, total_amount, payment_status, captured_at, created_at")
    .in("payment_status", ["captured", "refunded", "authorized"])
    .order("created_at", { ascending: false });

  const paymentIds = (payments ?? []).map((p) => p.id as string);
  const { data: lines } = paymentIds.length
    ? await supabase
        .from("statement_lines")
        .select("payment_id, service_name, self_pay_amount, cost_kind")
        .in("payment_id", paymentIds)
    : { data: [] as LineRow[] };

  const linesByPayment = new Map<string, LineRow[]>();
  for (const l of (lines ?? []) as LineRow[]) {
    if (!l.payment_id) continue;
    const arr = linesByPayment.get(l.payment_id) ?? [];
    arr.push(l);
    linesByPayment.set(l.payment_id, arr);
  }

  const items = (payments ?? []).map((p) => ({
    id: p.id as string,
    month: toMonthLabel((p.captured_at as string | null) ?? (p.created_at as string)),
    total: (p.total_amount as number) ?? 0,
    status: STATUS_LABEL[p.payment_status as string] ?? STATUS_LABEL.pending,
    lines: linesByPayment.get(p.id as string) ?? [],
  }));

  return (
    <PortalLayout portal="user">
      <h1 className="text-3xl font-bold mb-6">ご利用明細</h1>
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-base" style={{ color: "var(--qolc-muted)" }}>
              ご利用明細はまだありません。決済が行われると、ここに表示されます。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {items.map((m) => (
            <Card key={m.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{m.month}</CardTitle>
                  <span
                    className="text-sm px-3 py-1 rounded-full font-medium"
                    style={{ backgroundColor: m.status.bg, color: m.status.fg }}
                  >
                    {m.status.label}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {m.lines.length > 0 && (
                  <ul className="space-y-3 mb-4">
                    {m.lines.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex justify-between items-center border-b pb-2"
                        style={{ borderColor: "var(--qolc-border)" }}
                      >
                        <div>
                          <p className="font-semibold text-base">{item.service_name ?? "サービス"}</p>
                          {item.cost_kind === "other" && (
                            <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                              レセプト外の実費（家賃・食事・日用品など）
                            </p>
                          )}
                        </div>
                        <p className="text-xl font-bold">
                          ¥{(item.self_pay_amount ?? 0).toLocaleString("ja-JP")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-base">合計（お支払い額）</span>
                  <span className="text-2xl font-bold" style={{ color: "var(--qolc-primary)" }}>
                    ¥{m.total.toLocaleString("ja-JP")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
