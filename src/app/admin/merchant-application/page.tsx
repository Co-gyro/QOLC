import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { JcbEcForm } from "./_components/jcb-ec-form";
import { PrefillLoader } from "./_components/prefill-loader";
import { SaisonTab } from "./_components/saison-tab";

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
      <Breadcrumb
        items={[
          { label: "今日のUD", href: "/admin/today" },
          { label: "加盟店申請・登録", href: "/admin/applications" },
          { label: "申請書の作成" },
        ]}
      />
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">申請書の作成</h1>
        <p className="mt-2" style={{ color: "var(--qolc-muted)" }}>
          JCB・セゾンへの加盟申請に必要なExcelをここで出力します（案件詳細の「③
          申請書を作成」から開くと内容が自動反映されます）。
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
              <CardTitle>セゾン申込書（審査FMT）</CardTitle>
              <CardDescription>
                案件の内容を自動転記してExcelを出力します。提出はクリプト便です。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SaisonTab applicationId={applicationId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PortalLayout>
  );
}
