"use client";

import Link from "next/link";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table, {
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/Table";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, NOTIFY_STATUS_LABELS, NOTIFY_STATUS_COLORS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

// --- ダミーデータ ---

const stats = [
  { label: "入居者数", value: "87名", color: "text-gray-900" },
  { label: "今月の明細数", value: "342件", color: "text-gray-900" },
  { label: "今月の利用額", value: formatCurrency(4567890), color: "text-gray-900" },
  { label: "未通知", value: "12件", color: "text-red-600" },
];

const alerts = [
  { id: "a1", type: "error" as const, message: "決済エラー：3名の入居者で確認が必要です" },
];

const recentStatements = [
  { id: "s1", residentName: "山田 太郎", providerName: "田中内科クリニック", serviceDate: "2025-02-10", amount: 2820, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s2", residentName: "鈴木 花子", providerName: "さくら薬局", serviceDate: "2025-02-09", amount: 1540, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s3", residentName: "佐藤 一郎", providerName: "田中内科クリニック", serviceDate: "2025-02-08", amount: 8880, paymentStatus: "pending" as const, notifyStatus: "pending" as const },
  { id: "s4", residentName: "高橋 美咲", providerName: "あおぞらタクシー", serviceDate: "2025-02-07", amount: 3200, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s5", residentName: "中村 健太", providerName: "田中内科クリニック", serviceDate: "2025-02-06", amount: 8880, paymentStatus: "failed" as const, notifyStatus: "pending" as const },
];

const notices = [
  { id: "n1", date: "2025-02-01", title: "システムメンテナンスのお知らせ（2/15）" },
  { id: "n2", date: "2025-01-20", title: "新機能：領収書の自動発行機能をリリースしました" },
];

export default function FacilityDashboard() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">ダッシュボード</h2>
        <p className="mt-1 text-sm text-gray-500">施設全体の状況</p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardBody className="py-4 px-5">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* アラート */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200"
            >
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-red-800">{alert.message}</p>
              <Link href="/facility/statements" className="ml-auto text-sm text-red-600 hover:text-red-800 font-medium whitespace-nowrap">
                確認する →
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 最近の明細 */}
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">最近の明細</h3>
              <Link href="/facility/statements" className="text-sm text-emerald-600 hover:text-emerald-800">
                すべて見る →
              </Link>
            </div>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>入居者名</TableHeader>
                  <TableHeader>サービス提供者</TableHeader>
                  <TableHeader>サービス日</TableHeader>
                  <TableHeader>金額</TableHeader>
                  <TableHeader>決済</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentStatements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.residentName}</TableCell>
                    <TableCell>{s.providerName}</TableCell>
                    <TableCell>{s.serviceDate}</TableCell>
                    <TableCell>{formatCurrency(s.amount)}</TableCell>
                    <TableCell>
                      <Badge className={PAYMENT_STATUS_COLORS[s.paymentStatus]}>
                        {PAYMENT_STATUS_LABELS[s.paymentStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        {/* お知らせ */}
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">お知らせ</h3>
            <div className="space-y-4">
              {notices.map((notice) => (
                <div key={notice.id}>
                  <p className="text-xs text-gray-500">{notice.date}</p>
                  <p className="text-sm text-gray-900 mt-0.5">{notice.title}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
