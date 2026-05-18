import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

export default function FacilityStatementsPage() {
  return (
    <PortalLayout portal="facility">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/facility/dashboard" }, { label: "明細管理" }]} />
      <h1 className="text-2xl font-bold mb-6">明細管理</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>明細をアップロード</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-3" style={{ color: "var(--qolc-muted)" }}>
            提供者から預かった CSV ファイルをアップロードできます。
          </p>
          <a
            href="/provider/upload"
            className="qolc-btn inline-block px-4 py-2 rounded text-white font-medium"
            style={{ backgroundColor: "var(--qolc-primary)" }}
          >
            アップロード画面へ
          </a>
        </CardContent>
      </Card>
      <h2 className="text-lg font-semibold mb-3">アップロード履歴</h2>
      <EmptyState
        title="まだアップロード履歴がありません"
        description="提供者または施設から明細をアップロードすると、ここに表示されます。"
      />
    </PortalLayout>
  );
}
