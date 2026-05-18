import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UserCardPage() {
  // モック: 実際は resident_accounts.usen_member_id から取得
  const cardRegistered = true;
  const isPaymentOwner = true;
  const cardBrand = "Visa";
  const cardLast4 = "1234";
  const cardExpiry = "2030/12";

  return (
    <PortalLayout portal="user">
      <h1 className="text-3xl font-bold mb-6">カード管理</h1>
      {cardRegistered ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">登録済みカード</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: "var(--qolc-bg-soft)" }}>
              <p className="text-2xl font-bold">
                {cardBrand} •••• {cardLast4}
              </p>
              <p className="text-base mt-1" style={{ color: "var(--qolc-muted)" }}>
                有効期限: {cardExpiry}
              </p>
            </div>
            {isPaymentOwner ? (
              <button
                className="qolc-btn px-6 py-3 rounded text-white text-base font-medium"
                style={{ backgroundColor: "var(--qolc-primary)", minHeight: 48 }}
              >
                カードを変更
              </button>
            ) : (
              <p className="text-sm p-3 rounded" style={{ backgroundColor: "var(--qolc-bg-soft)", color: "var(--qolc-muted)" }}>
                カードの変更は支払い担当者のみ可能です。
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card style={{ borderColor: "var(--qolc-accent)", borderWidth: 2 }}>
          <CardHeader>
            <CardTitle className="text-xl">カードが未登録です</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base mb-4">
              ご利用にはクレジットカードの登録が必要です。
            </p>
            <button
              className="qolc-btn px-8 py-4 rounded text-white text-lg font-bold"
              style={{ backgroundColor: "var(--qolc-primary)", minHeight: 56 }}
            >
              カードを登録する
            </button>
          </CardContent>
        </Card>
      )}
    </PortalLayout>
  );
}
