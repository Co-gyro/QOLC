import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Store,
  Users,
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
 * 運営管理者（ユニバーサル）ポータル — QOLC運営側のダッシュボード（モックアップ）
 * 全施設・全加盟店を横断する KPI、申請承認、ツールへの導線を提供。
 */

const CURRENCY = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const KPI = {
  monthlyGmv: 18_240_000,
  monthlyTransactions: 4_312,
  activeFacilities: 27,
  activeProviders: 14,
  pendingApplications: 3,
  failedPayments: 8,
};

interface PortalLink {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PORTALS: PortalLink[] = [
  {
    href: "/facility",
    title: "介護施設ポータル",
    description: "入居者一覧・明細アップロード・決済状況の確認",
    icon: Building2,
  },
  {
    href: "/provider",
    title: "サービス提供者ポータル",
    description: "売上サマリー・入金予定・取引先施設",
    icon: Store,
  },
  {
    href: "/user",
    title: "マイページ（入居者・家族）",
    description: "利用明細の閲覧・カード変更",
    icon: Users,
  },
];

const TOOLS: PortalLink[] = [
  {
    href: "/admin/csv-tools",
    title: "CSV変換ツール",
    description:
      "JCB Link / セゾン Net アンサー forBiz からの明細を Shift-JIS CSV に変換",
    icon: FileSpreadsheet,
  },
  {
    href: "/admin/merchant-application",
    title: "加盟店申請フォーム",
    description: "JCB / セゾン向け加盟店申請 Excel の生成",
    icon: FileText,
  },
];

const PENDING_APPLICATIONS = [
  {
    id: "APP-2026-0512",
    facility: "コルクの杜 介護施設 桜館",
    type: "JCB EC版",
    submittedAt: "2026-05-12",
    status: "書類確認中",
  },
  {
    id: "APP-2026-0510",
    facility: "ふじみケアセンター",
    type: "セゾン店頭版",
    submittedAt: "2026-05-10",
    status: "差戻し対応待ち",
  },
  {
    id: "APP-2026-0508",
    facility: "陽だまりの家 西新井",
    type: "JCB店頭版",
    submittedAt: "2026-05-08",
    status: "書類確認中",
  },
];

const RECENT_ACTIVITY = [
  {
    time: "2026-05-14 09:42",
    text: "コルクの杜 桜館 が 12 件の明細をアップロード（¥48,640）",
    tone: "info" as const,
  },
  {
    time: "2026-05-14 08:15",
    text: "JCB 加盟店申請 APP-2026-0512 が提出されました",
    tone: "info" as const,
  },
  {
    time: "2026-05-13 22:08",
    text: "決済失敗が 3 件発生（カード期限切れ）",
    tone: "warn" as const,
  },
  {
    time: "2026-05-13 17:30",
    text: "セゾン UR CSV のセルフィッシュ送信が完了（27件）",
    tone: "ok" as const,
  },
];

function KpiCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "warn" | "ok";
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-700"
      : tone === "ok"
        ? "text-emerald-700"
        : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle className={`text-2xl ${toneClass}`}>{value}</CardTitle>
      </CardHeader>
      {sub && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{sub}</p>
        </CardContent>
      )}
    </Card>
  );
}

export default function OperatorPortal() {
  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-white">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs text-muted-foreground">QOLC 運営管理者ポータル</p>
            <h1 className="text-lg font-semibold leading-tight">
              ダッシュボード
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">運営: 株式会社GetBetters</p>
            <p className="text-xs text-muted-foreground">2026年5月14日</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* KPI */}
        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="今月のGMV"
            value={CURRENCY.format(KPI.monthlyGmv)}
            sub="前月比 +12.4%"
            tone="ok"
          />
          <KpiCard
            label="決済件数"
            value={KPI.monthlyTransactions.toLocaleString()}
            sub="今月累計"
          />
          <KpiCard
            label="稼働施設"
            value={`${KPI.activeFacilities}施設`}
          />
          <KpiCard
            label="サービス提供者"
            value={`${KPI.activeProviders}社`}
          />
          <KpiCard
            label="申請承認待ち"
            value={`${KPI.pendingApplications}件`}
            tone={KPI.pendingApplications > 0 ? "warn" : "default"}
          />
          <KpiCard
            label="決済失敗"
            value={`${KPI.failedPayments}件`}
            sub="要対応"
            tone="warn"
          />
        </section>

        {/* ポータル切替 */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            ポータル切替
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {PORTALS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="group rounded-lg border bg-white p-4 transition hover:border-slate-400 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{p.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 承認待ち & 最近のアクティビティ */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                加盟店申請 承認待ち
              </CardTitle>
              <CardDescription>{PENDING_APPLICATIONS.length}件の確認が必要です</CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <ul className="divide-y">
                {PENDING_APPLICATIONS.map((app) => (
                  <li
                    key={app.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 sm:px-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {app.facility}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {app.id} ・ {app.type} ・ 提出 {app.submittedAt}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                      {app.status}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                最近のアクティビティ
              </CardTitle>
              <CardDescription>直近24時間</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {RECENT_ACTIVITY.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {a.tone === "warn" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  ) : a.tone === "ok" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <HandCoins className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  )}
                  <div className="min-w-0">
                    <p className="leading-snug">{a.text}</p>
                    <p className="text-xs text-muted-foreground">{a.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* 管理ツール */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            管理ツール
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {TOOLS.map((tool) => (
              <Card key={tool.href} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <tool.icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{tool.title}</CardTitle>
                  </div>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={tool.href}>開く</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
