import Link from "next/link";
import { ArrowLeft, CreditCard, Receipt, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * 入居者・家族向けマイページ（モックアップ）
 * 実データは Supabase 連携後に差し替え予定。現状はUI確認用のサンプル。
 */

type PaymentStatus = "paid" | "pending" | "failed";

interface StatementItem {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  description: string;
  amount: number;
  status: PaymentStatus;
}

const RESIDENT = {
  name: "山田 花子",
  nameKana: "ヤマダ ハナコ",
  facility: "コルクの杜 介護施設 桜館",
  roomNumber: "203号室",
  familyName: "山田 太郎（長男）",
};

const CARD = {
  brand: "JCB",
  last4: "4321",
  holder: "TARO YAMADA",
  expiry: "08/29",
};

const SUMMARY = {
  period: "2026年5月",
  total: 38_640,
  paidCount: 8,
  pendingCount: 2,
  nextChargeDate: "2026-05-31",
};

const STATEMENTS: StatementItem[] = [
  {
    id: "s-2026-05-12-01",
    date: "2026-05-12",
    category: "理美容",
    description: "訪問理容（カット）",
    amount: 3_300,
    status: "paid",
  },
  {
    id: "s-2026-05-10-01",
    date: "2026-05-10",
    category: "レクリエーション",
    description: "外出レク（バス代・入場料）",
    amount: 2_500,
    status: "paid",
  },
  {
    id: "s-2026-05-09-01",
    date: "2026-05-09",
    category: "嗜好品",
    description: "売店利用（飲料・お菓子）",
    amount: 1_240,
    status: "paid",
  },
  {
    id: "s-2026-05-08-01",
    date: "2026-05-08",
    category: "医療関連",
    description: "通院付き添い（タクシー）",
    amount: 4_800,
    status: "pending",
  },
  {
    id: "s-2026-05-05-01",
    date: "2026-05-05",
    category: "イベント",
    description: "母の日特別食",
    amount: 1_500,
    status: "paid",
  },
  {
    id: "s-2026-05-03-01",
    date: "2026-05-03",
    category: "日用品",
    description: "おむつ・パッド類",
    amount: 6_800,
    status: "paid",
  },
  {
    id: "s-2026-05-02-01",
    date: "2026-05-02",
    category: "リハビリ",
    description: "個別機能訓練（自費分）",
    amount: 5_500,
    status: "pending",
  },
  {
    id: "s-2026-05-01-01",
    date: "2026-05-01",
    category: "嗜好品",
    description: "売店利用",
    amount: 880,
    status: "paid",
  },
  {
    id: "s-2026-05-01-02",
    date: "2026-05-01",
    category: "理美容",
    description: "毛染め",
    amount: 4_400,
    status: "paid",
  },
  {
    id: "s-2026-04-30-01",
    date: "2026-04-30",
    category: "イベント",
    description: "春の園遊会 参加費",
    amount: 3_000,
    status: "paid",
  },
];

const CURRENCY = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const DATE_FMT = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, { label: string; className: string }> = {
    paid: {
      label: "決済済み",
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    },
    pending: {
      label: "処理中",
      className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    },
    failed: {
      label: "失敗",
      className: "bg-red-50 text-red-700 ring-1 ring-red-200",
    },
  };
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}
    >
      {s.label}
    </span>
  );
}

export default function UserMyPage() {
  const paidTotal = STATEMENTS.filter((s) => s.status === "paid").reduce(
    (sum, s) => sum + s.amount,
    0,
  );
  const pendingTotal = STATEMENTS.filter((s) => s.status === "pending").reduce(
    (sum, s) => sum + s.amount,
    0,
  );

  return (
    <main className="min-h-screen bg-muted/30">
      {/* ヘッダー */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="トップへ"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-xs text-muted-foreground">QOLC マイページ</p>
              <h1 className="text-lg font-semibold leading-tight">
                {RESIDENT.name} さま
              </h1>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-xs text-muted-foreground">{RESIDENT.facility}</p>
            <p className="text-xs text-muted-foreground">
              {RESIDENT.roomNumber} / ご家族: {RESIDENT.familyName}
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
        {/* 当月サマリー */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Card className="sm:col-span-2">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Receipt className="h-4 w-4" />
                {SUMMARY.period} の合計
              </CardDescription>
              <CardTitle className="text-3xl">
                {CURRENCY.format(SUMMARY.total)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-emerald-50 p-3">
                  <dt className="text-xs text-emerald-700">決済済み</dt>
                  <dd className="mt-0.5 font-semibold text-emerald-900">
                    {CURRENCY.format(paidTotal)}
                    <span className="ml-1 text-xs font-normal text-emerald-700">
                      ({SUMMARY.paidCount}件)
                    </span>
                  </dd>
                </div>
                <div className="rounded-md bg-amber-50 p-3">
                  <dt className="text-xs text-amber-700">処理中</dt>
                  <dd className="mt-0.5 font-semibold text-amber-900">
                    {CURRENCY.format(pendingTotal)}
                    <span className="ml-1 text-xs font-normal text-amber-700">
                      ({SUMMARY.pendingCount}件)
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                次回カード請求予定日:{" "}
                <span className="font-medium text-foreground">
                  {formatDate(SUMMARY.nextChargeDate)}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" />
                登録カード
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 p-4 text-white">
                <p className="text-xs opacity-80">{CARD.brand}</p>
                <p className="mt-3 font-mono text-base tracking-widest">
                  •••• •••• •••• {CARD.last4}
                </p>
                <div className="mt-3 flex items-end justify-between text-xs">
                  <span className="opacity-80">{CARD.holder}</span>
                  <span className="opacity-80">{CARD.expiry}</span>
                </div>
              </div>
              <Button variant="outline" className="mt-3 w-full" size="sm">
                カード情報を変更
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* 明細リスト */}
        <section>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">利用明細</CardTitle>
                  <CardDescription>
                    {SUMMARY.period}の利用分（新しい順）
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  PDFでダウンロード
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <ul className="divide-y">
                {STATEMENTS.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3 sm:px-0"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {item.category.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.date)} ・ {item.category}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">
                        {CURRENCY.format(item.amount)}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* お知らせ */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                ご家族へのお知らせ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                ・5月31日に当月分のカード請求が確定します。明細はLINEでも通知されます。
              </p>
              <p>
                ・利用明細に不明な点がある場合は、施設担当者または「お問い合わせ」よりご連絡ください。
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
