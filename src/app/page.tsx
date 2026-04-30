import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ToolItem {
  href: string;
  title: string;
  description: string;
  cta: string;
}

const TOOLS: ToolItem[] = [
  {
    href: "/admin/csv-tools",
    title: "CSV変換ツール",
    description:
      "JCB Link / セゾン Net アンサー forBiz からダウンロードした明細をセルフィッシュ命名規則にリネーム・集計し、Shift-JIS の CSV を生成します。",
    cta: "CSV変換ツールを開く",
  },
  {
    href: "/admin/merchant-application",
    title: "加盟店申請フォーム",
    description:
      "JCB / セゾンへの加盟店申請に必要な Excel フォーマットを生成。法人/個人区分による条件付き入力、カナ・郵便番号・年齢などの自動バリデーション付き。",
    cta: "加盟店申請フォームを開く",
  },
];

export default function Home() {
  return (
    <main className="container mx-auto max-w-4xl py-16">
      <header className="mb-12 text-center">
        <h1 className="text-5xl font-bold tracking-tight">QOLC</h1>
        <p className="mt-3 text-lg text-muted-foreground">介護施設向け決済SaaS</p>
        <p className="mt-1 text-sm text-muted-foreground">Phase 0: 管理ツール</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Card key={tool.href} className="flex flex-col">
            <CardHeader>
              <CardTitle>{tool.title}</CardTitle>
              <CardDescription>{tool.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full">
                <Link href={tool.href}>{tool.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
