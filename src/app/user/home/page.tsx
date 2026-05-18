import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UserHomePage() {
  return (
    <PortalLayout portal="user">
      <h1 className="text-3xl font-bold mb-6">こんにちは、田中花子さん</h1>

      <Card className="mb-6" style={{ borderColor: "var(--qolc-accent)", borderWidth: 2 }}>
        <CardHeader>
          <CardTitle className="text-xl">お知らせ（1件）</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base">2026年4月分の領収書をご覧いただけます。</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl">今月のご利用額</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold" style={{ color: "var(--qolc-primary)" }}>
            ¥28,500
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--qolc-muted)" }}>
            ※ 5月15日時点
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">カード登録状況</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base mb-3">
            登録済みカード: <span className="font-bold">Visa •••• 1234</span>
          </p>
          <a
            href="/user/card"
            className="qolc-btn inline-block px-6 py-3 rounded text-white text-lg font-medium"
            style={{ backgroundColor: "var(--qolc-primary)", minHeight: 48 }}
          >
            カード管理画面へ
          </a>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
