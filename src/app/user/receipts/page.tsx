import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MOCK_RECEIPTS = [
  { id: "r1", month: "2026年5月", amount: 22500 },
  { id: "r2", month: "2026年4月", amount: 17000 },
  { id: "r3", month: "2026年3月", amount: 19500 },
];

export default function UserReceiptsPage() {
  return (
    <PortalLayout portal="user">
      <h1 className="text-3xl font-bold mb-6">領収書</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK_RECEIPTS.map((r) => (
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
                className="qolc-btn inline-block px-6 py-3 rounded text-white font-medium text-base"
                style={{ backgroundColor: "var(--qolc-primary)", minHeight: 48 }}
              >
                PDFをダウンロード
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </PortalLayout>
  );
}
