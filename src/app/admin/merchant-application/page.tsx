import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { JcbEcForm } from "./_components/jcb-ec-form";
import { PrefillLoader } from "./_components/prefill-loader";

/** UUID 形式チェック（不正な applicationId はプリフィルせず空フォームにする） */
function isUuid(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(id);
}

export default function MerchantApplicationPage({
  searchParams,
}: {
  searchParams?: { applicationId?: string };
}) {
  const applicationId =
    searchParams?.applicationId && isUuid(searchParams.applicationId)
      ? searchParams.applicationId
      : null;
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "加盟店管理", href: "/admin/merchants" }, { label: "申請書出力" }]} />
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">加盟店申請管理</h1>
        <p className="mt-2" style={{ color: "var(--qolc-muted)" }}>
          JCB / セゾンへの加盟申請に必要なExcelフォーマットを生成します。
        </p>
      </div>

      <Tabs defaultValue="jcb" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="jcb">JCB (EC版/店頭版)</TabsTrigger>
          <TabsTrigger value="saison">セゾン</TabsTrigger>
        </TabsList>

        <TabsContent value="jcb" className="mt-6">
          {applicationId ? <PrefillLoader applicationId={applicationId} /> : <JcbEcForm />}
        </TabsContent>

        <TabsContent value="saison" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>セゾン</CardTitle>
              <CardDescription>セゾン加盟店申請用フォーマット。</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">準備中</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PortalLayout>
  );
}
