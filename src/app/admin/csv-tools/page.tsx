import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JcbRenameTool } from "./_components/jcb-rename-tool";
import { SaisonRenameTool } from "./_components/saison-rename-tool";
import { SaisonFmTool } from "./_components/saison-fm-tool";
import { SaisonFiTool } from "./_components/saison-fi-tool";

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
          <Tabs defaultValue="ur" className="w-full">
            <TabsList className="grid w-full max-w-xl grid-cols-3">
              <TabsTrigger value="ur">売上明細 (UR)</TabsTrigger>
              <TabsTrigger value="fm">振込明細 (FM)</TabsTrigger>
              <TabsTrigger value="fi">振込情報 (FI)</TabsTrigger>
            </TabsList>

            <TabsContent value="ur" className="mt-6">
              <SaisonRenameTool />
            </TabsContent>

            <TabsContent value="fm" className="mt-6">
              <SaisonFmTool />
            </TabsContent>

            <TabsContent value="fi" className="mt-6">
              <SaisonFiTool />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </main>
  );
}
