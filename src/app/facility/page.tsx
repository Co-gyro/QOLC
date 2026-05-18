import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Search,
  Upload,
  UserPlus,
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
 * 介護施設ポータル — 施設の事務担当者向けダッシュボード（モックアップ）
 */

const CURRENCY = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const FACILITY = {
  name: "コルクの杜 介護施設 桜館",
  manager: "鈴木 一郎",
  residentCount: 42,
};

const SUMMARY = {
  monthlyTotal: 1_842_400,
  paidCount: 312,
  pendingCount: 14,
  failedCount: 3,
  cardRegistered: 39,
  cardMissing: 3,
};

type ResidentStatus = "ok" | "card_missing" | "payment_failed";

interface Resident {
  id: string;
  name: string;
  room: string;
  mtdAmount: number;
  itemCount: number;
  status: ResidentStatus;
}

const RESIDENTS: Resident[] = [
  {
    id: "R-001",
    name: "山田 花子",
    room: "203",
    mtdAmount: 38_640,
    itemCount: 10,
    status: "ok",
  },
  {
    id: "R-002",
    name: "佐藤 健",
    room: "204",
    mtdAmount: 24_800,
    itemCount: 7,
    status: "ok",
  },
  {
    id: "R-003",
    name: "高橋 みどり",
    room: "205",
    mtdAmount: 52_300,
    itemCount: 14,
    status: "payment_failed",
  },
  {
    id: "R-004",
    name: "渡辺 三郎",
    room: "206",
    mtdAmount: 18_200,
    itemCount: 5,
    status: "ok",
  },
  {
    id: "R-005",
    name: "中村 房子",
    room: "301",
    mtdAmount: 0,
    itemCount: 0,
    status: "card_missing",
  },
  {
    id: "R-006",
    name: "小林 義男",
    room: "302",
    mtdAmount: 41_100,
    itemCount: 11,
    status: "ok",
  },
  {
    id: "R-007",
    name: "斉藤 千代",
    room: "303",
    mtdAmount: 29_700,
    itemCount: 9,
    status: "ok",
  },
  {
    id: "R-008",
    name: "井上 正治",
    room: "304",
    mtdAmount: 15_400,
    itemCount: 4,
    status: "ok",
  },
];

const RECENT_UPLOADS = [
  {
    file: "2026-05-13_理美容明細.csv",
    rows: 12,
    amount: 39_600,
    uploadedAt: "2026-05-13 17:22",
  },
  {
    file: "2026-05-10_売店利用.csv",
    rows: 38,
    amount: 24_180,
    uploadedAt: "2026-05-10 19:05",
  },
  {
    file: "2026-05-05_母の日特別食.csv",
    rows: 42,
    amount: 63_000,
    uploadedAt: "2026-05-05 14:48",
  },
];

function ResidentStatusBadge({ status }: { status: ResidentStatus }) {
  const cfg = {
    ok: {
      label: "正常",
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    },
    card_missing: {
      label: "カード未登録",
      className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    },
    payment_failed: {
      label: "決済失敗あり",
      className: "bg-red-50 text-red-700 ring-1 ring-red-200",
    },
  }[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

export default function FacilityPortal() {
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
              <p className="text-xs text-muted-foreground">QOLC 介護施設ポータル</p>
              <h1 className="text-lg font-semibold leading-tight">
                {FACILITY.name}
              </h1>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-xs text-muted-foreground">担当: {FACILITY.manager}</p>
            <p className="text-xs text-muted-foreground">
              入居者 {FACILITY.residentCount}名
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* サマリー */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">今月の決済合計</CardDescription>
              <CardTitle className="text-2xl">
                {CURRENCY.format(SUMMARY.monthlyTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                決済済み {SUMMARY.paidCount}件 / 処理中 {SUMMARY.pendingCount}件
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                決済失敗
              </CardDescription>
              <CardTitle className="text-2xl text-amber-700">
                {SUMMARY.failedCount}件
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">要対応 — ご家族へ連絡</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <CreditCard className="h-3.5 w-3.5" />
                カード登録済み
              </CardDescription>
              <CardTitle className="text-2xl">
                {SUMMARY.cardRegistered}
                <span className="text-base text-muted-foreground">
                  /{FACILITY.residentCount}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                未登録 {SUMMARY.cardMissing}名
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" />
                入居者
              </CardDescription>
              <CardTitle className="text-2xl">
                {FACILITY.residentCount}名
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        {/* アクション */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">明細をアップロード</CardTitle>
              <CardDescription>
                売店・理美容・付き添いタクシーなどの利用明細をCSVで取り込めます
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                CSVをアップロード
              </Button>
              <Button variant="outline">手入力で追加</Button>
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                入居者を追加
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* 入居者一覧 */}
        <section>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">入居者一覧</CardTitle>
                  <CardDescription>今月の利用状況</CardDescription>
                </div>
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    placeholder="氏名・部屋番号で検索"
                    className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium sm:px-0">
                        氏名
                      </th>
                      <th className="px-4 py-2 text-left font-medium">部屋</th>
                      <th className="px-4 py-2 text-right font-medium">
                        今月利用額
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        件数
                      </th>
                      <th className="px-4 py-2 text-left font-medium">
                        ステータス
                      </th>
                      <th className="px-4 py-2 sm:px-0" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {RESIDENTS.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2.5 font-medium sm:px-0">
                          {r.name}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {r.room}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {CURRENCY.format(r.mtdAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                          {r.itemCount}
                        </td>
                        <td className="px-4 py-2.5">
                          <ResidentStatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right sm:px-0">
                          <Link
                            href="/user"
                            className="text-xs font-medium text-slate-700 underline-offset-4 hover:underline"
                          >
                            明細を見る
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 最近のアップロード */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                最近のアップロード
              </CardTitle>
              <CardDescription>過去7日</CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <ul className="divide-y">
                {RECENT_UPLOADS.map((u) => (
                  <li
                    key={u.file}
                    className="flex items-center justify-between gap-3 px-4 py-3 sm:px-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{u.file}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.uploadedAt} ・ {u.rows}件
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {CURRENCY.format(u.amount)}
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
