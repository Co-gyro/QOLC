import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JcbEcForm } from "./_components/jcb-ec-form";

export default function MerchantApplicationPage() {
  return (
    <main className="container mx-auto max-w-5xl py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">加盟店申請管理</h1>
        <p className="mt-2 text-muted-foreground">
          JCB / セゾンへの加盟申請に必要なExcelフォーマットを生成します。
        </p>
      </div>

      <Tabs defaultValue="jcb-ec" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="jcb-ec">JCB EC版</TabsTrigger>
          <TabsTrigger value="jcb-store">JCB 店頭版</TabsTrigger>
          <TabsTrigger value="saison">セゾン</TabsTrigger>
        </TabsList>

        <TabsContent value="jcb-ec" className="mt-6">
          <JcbEcForm />
        </TabsContent>

        <TabsContent value="jcb-store" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>JCB 店頭版</CardTitle>
              <CardDescription>店頭加盟店登録用フォーマット。</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">準備中</p>
            </CardContent>
          </Card>
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
    </main>
  );
}
