import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * サービス提供者ポータル — 物販・サービスを介護施設に提供する事業者向け（モックアップ）
 */

const CURRENCY = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const PROVIDER = {
  name: "桜美容サービス株式会社",
  category: "訪問理美容",
  contractedFacilities: 8,
};

const SUMMARY = {
  monthlySales: 642_300,
  monthlyTransactions: 187,
  pendingPayout: 218_900,
  nextPayoutDate: "2026-05-31",
};

interface Payout {
  id: string;
  period: string;
  facility: string;
  amount: number;
  scheduledAt: string;
  status: "scheduled" | "paid";
}

const PAYOUTS: Payout[] = [
  {
    id: "PO-2026-05-A",
    period: "2026/04",
    facility: "コルクの杜 桜館",
    amount: 138_400,
    scheduledAt: "2026-05-15",
    status: "scheduled",
  },
  {
    id: "PO-2026-05-B",
    period: "2026/04",
    facility: "ふじみケアセンター",
    amount: 80_500,
    scheduledAt: "2026-05-15",
    status: "scheduled",
  },
  {
    id: "PO-2026-04-A",
    period: "2026/03",
    facility: "コルクの杜 桜館",
    amount: 124_200,
    scheduledAt: "2026-04-15",
    status: "paid",
  },
  {
    id: "PO-2026-04-B",
    period: "2026/03",
    facility: "陽だまりの家 西新井",
    amount: 92_800,
    scheduledAt: "2026-04-15",
    status: "paid",
  },
];

const FACILITIES = [
  { name: "コルクの杜 桜館", residents: 42, mtdAmount: 198_400 },
  { name: "ふじみケアセンター", residents: 31, mtdAmount: 124_900 },
  { name: "陽だまりの家 西新井", residents: 28, mtdAmount: 108_200 },
  { name: "あおぞらホーム 上野", residents: 22, mtdAmount: 86_700 },
  { name: "みどりの郷 浦和", residents: 18, mtdAmount: 65_300 },
  { name: "なごみケア 練馬", residents: 25, mtdAmount: 58_800 },
];

export default function ProviderPortal() {
  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-white">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="運営ポータルへ"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-xs text-muted-foreground">
                QOLC サービス提供者ポータル
              </p>
              <h1 className="text-lg font-semibold leading-tight">
                {PROVIDER.name}
              </h1>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-xs text-muted-foreground">
              業種: {PROVIDER.category}
            </p>
            <p className="text-xs text-muted-foreground">
              契約施設: {PROVIDER.contractedFacilities}施設
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* サマリー */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5" />
                今月の売上
              </CardDescription>
              <CardTitle className="text-2xl">
                {CURRENCY.format(SUMMARY.monthlySales)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-emerald-700">前月比 +8.2%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">今月の取引数</CardDescription>
              <CardTitle className="text-2xl">
                {SUMMARY.monthlyTransactions}件
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <Wallet className="h-3.5 w-3.5" />
                入金予定額
              </CardDescription>
              <CardTitle className="text-2xl">
                {CURRENCY.format(SUMMARY.pendingPayout)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <CalendarClock className="h-3.5 w-3.5" />
                次回入金日
              </CardDescription>
              <CardTitle className="text-2xl">
                {SUMMARY.nextPayoutDate.slice(5)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                {SUMMARY.nextPayoutDate}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* アクション */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">明細を登録</CardTitle>
              <CardDescription>
                CSV または手入力で利用明細をアップロードできます
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                CSVをアップロード
              </Button>
              <Button variant="outline">手入力で登録</Button>
              <Button variant="outline">テンプレートをDL</Button>
            </CardContent>
          </Card>
        </section>

        {/* 入金スケジュール & 契約施設 */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">入金スケジュール</CardTitle>
              <CardDescription>直近の入金予定・履歴</CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <ul className="divide-y">
                {PAYOUTS.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 sm:px-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {p.facility}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.period} 分 ・ {p.scheduledAt} 振込
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">
                        {CURRENCY.format(p.amount)}
                      </span>
                      {p.status === "paid" ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                          振込済み
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                          予定
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                契約施設一覧
              </CardTitle>
              <CardDescription>
                各施設の今月の売上（多い順）
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <ul className="divide-y">
                {FACILITIES.map((f) => (
                  <li
                    key={f.name}
                    className="flex items-center justify-between gap-3 px-4 py-3 sm:px-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        入居者 {f.residents}名
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {CURRENCY.format(f.mtdAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
