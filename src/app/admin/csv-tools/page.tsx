import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JcbRenameTool } from "./_components/jcb-rename-tool";

export default function CsvToolsPage() {
  return (
    <main className="container mx-auto max-w-5xl py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">CSV変換ツール</h1>
        <p className="mt-2 text-muted-foreground">
          カード会社のCSVをセルフィッシュ命名規則でリネーム/集計します。
        </p>
      </div>

      <Tabs defaultValue="jcb" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="jcb">JCB</TabsTrigger>
          <TabsTrigger value="saison">セゾン</TabsTrigger>
        </TabsList>

        <TabsContent value="jcb" className="mt-6">
          <JcbRenameTool />
        </TabsContent>

        <TabsContent value="saison" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>セゾン</CardTitle>
              <CardDescription>
                売上データCSV(UR)のリネーム、支払計算書PDFを使った支払情報(FI)/支払明細(FM)
                の集計処理を予定しています。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
