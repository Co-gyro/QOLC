import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminMasterPage() {
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "マスタ管理" }]} />
      <h1 className="text-2xl font-bold mb-6">マスタ管理</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>モールコードプール</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-2">A300〜A3ZZ（合計 1,296件）</p>
            <p className="text-2xl font-bold" style={{ color: "var(--qolc-primary)" }}>
              残: 1,293 / 1,296
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>端末識別番号プール</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-2">3124620001000〜3124620001999（1,000件）</p>
            <p className="text-2xl font-bold" style={{ color: "var(--qolc-primary)" }}>
              残: 998 / 1,000
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>サービス種別マスタ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">登録件数: 13件（開発用ダミー）</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>アップロードフォーマット</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">登録件数: 0件</p>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
