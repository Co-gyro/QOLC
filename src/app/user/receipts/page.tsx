import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** ISO(yyyy-mm-...) から「2026年6月」表記を作る（TZ非依存） */
function toMonthLabel(iso: string | null): string {
  if (!iso) return "";
  const [y, m] = iso.slice(0, 7).split("-");
  return `${y}年${Number(m)}月`;
}

/**
 * ユーザーポータル 領収書一覧。
 * 売上計上済み（captured/refunded）の自分の決済を RLS（family read）経由で取得し、
 * 各決済の「利用料請求書兼領収書」PDFを /api/receipts/[paymentId] からダウンロードできる。
 */
export default async function UserReceiptsPage() {
  const supabase = createSupabaseServerClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("id, total_amount, captured_at, created_at, payment_status")
    .in("payment_status", ["captured", "refunded"])
    .order("captured_at", { ascending: false });

  const items = (payments ?? []).map((p) => ({
    id: p.id as string,
    month: toMonthLabel((p.captured_at as string | null) ?? (p.created_at as string)),
    amount: (p.total_amount as number) ?? 0,
  }));

  return (
    <PortalLayout portal="user">
      <h1 className="text-3xl font-bold mb-6">領収書</h1>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-base" style={{ color: "var(--qolc-muted)" }}>
              発行できる領収書はまだありません。決済が完了すると、ここに表示されます。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-xl">{r.month}</CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className="text-3xl font-bold mb-4"
                  style={{ color: "var(--qolc-primary)" }}
                >
                  ¥{r.amount.toLocaleString("ja-JP")}
                </p>
                <a
                  href={`/api/receipts/${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="qolc-btn inline-block px-6 py-3 rounded text-white font-medium text-base"
                  style={{ backgroundColor: "var(--qolc-primary)", minHeight: 48 }}
                >
                  PDFをダウンロード
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
