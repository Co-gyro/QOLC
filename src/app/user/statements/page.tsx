import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MOCK_STATEMENTS = [
  {
    month: "2026年5月",
    items: [
      { provider: "テスト診療所", service: "訪問診療", amount: 12000 },
      { provider: "テスト薬局", service: "処方薬", amount: 6500 },
      { provider: "テストタクシー", service: "介護タクシー", amount: 4000 },
    ],
  },
  {
    month: "2026年4月",
    items: [
      { provider: "テスト診療所", service: "訪問診療", amount: 12000 },
      { provider: "テスト薬局", service: "処方薬", amount: 5000 },
    ],
  },
];

export default function UserStatementsPage() {
  return (
    <PortalLayout portal="user">
      <h1 className="text-3xl font-bold mb-6">ご利用明細</h1>
      <div className="space-y-6">
        {MOCK_STATEMENTS.map((m) => {
          const total = m.items.reduce((s, i) => s + i.amount, 0);
          return (
            <Card key={m.month}>
              <CardHeader>
                <CardTitle className="text-xl">{m.month}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-4">
                  {m.items.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex justify-between items-center border-b pb-2"
                      style={{ borderColor: "var(--qolc-border)" }}
                    >
                      <div>
                        <p className="font-semibold text-base">{item.provider}</p>
                        <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                          {item.service}
                        </p>
                      </div>
                      <p className="text-xl font-bold">
                        ¥{item.amount.toLocaleString("ja-JP")}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-base">合計</span>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: "var(--qolc-primary)" }}
                  >
                    ¥{total.toLocaleString("ja-JP")}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PortalLayout>
  );
}
