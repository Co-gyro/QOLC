import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { JcbRenameTool } from "./_components/jcb-rename-tool";
import { SaisonUnifiedTool } from "./_components/saison-unified-tool";

export default function CsvToolsPage() {
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "今日のUD", href: "/admin/today" }, { label: "精算CSV変換" }]} />
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">精算CSV変換</h1>
        <p className="mt-2" style={{ color: "var(--qolc-muted)" }}>
          カード会社のCSVをセルフィッシュ命名規則でリネーム/集計する、月次精算専用のツールです。
          通常は「月次精算・チェック」の工程の中で使います。
          加盟店申請の申請書作成はここではなく、「加盟店申請・登録」の各案件（登録手続き）から行います。
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
          <SaisonUnifiedTool />
        </TabsContent>
      </Tabs>
    </PortalLayout>
  );
}
