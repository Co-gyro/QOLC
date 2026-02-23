"use client";

import Link from "next/link";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

// --- ダミーデータ ---

// 【1. 統計カード】
const overallStats = {
  facilities: 48,
  merchants: 156,
  residents: 2847,
  monthlyPaymentTotal: 24567890,
};

// 【2. アラート】
const alerts = [
  { id: "a1", type: "error" as const, message: "決済エラー：3件の未処理があります", link: "/payments" },
  { id: "a2", type: "warning" as const, message: "領収書発行エラー：1件の確認が必要です", link: "/receipts" },
];

// 【3. 外部システム状況】
type SystemStatus = "ok" | "delay" | "error";

const externalSystems: {
  id: string;
  name: string;
  status: SystemStatus;
  lastCommunication: string;
}[] = [
  { id: "usen", name: "USEN PSP", status: "ok", lastCommunication: "5分前" },
  { id: "selfish", name: "セルフィッシュ", status: "ok", lastCommunication: "1時間前" },
  { id: "line", name: "LINE Messaging API", status: "ok", lastCommunication: "10分前" },
  { id: "sendgrid", name: "メール（SendGrid）", status: "ok", lastCommunication: "30分前" },
];

const systemStatusConfig: Record<SystemStatus, { icon: string; label: string; color: string }> = {
  ok: { icon: "\u2705", label: "正常", color: "text-green-700 bg-green-50" },
  delay: { icon: "\u26a0\ufe0f", label: "遅延", color: "text-yellow-700 bg-yellow-50" },
  error: { icon: "\u274c", label: "エラー", color: "text-red-700 bg-red-50" },
};

// 【4. 最近のアクティビティ】
const recentStatements = [
  {
    id: "st1",
    facilityName: "さくら介護施設",
    merchantName: "田中内科クリニック",
    serviceType: "medical" as const,
    residentName: "山田 太郎",
    selfPayAmount: 12500,
    paymentStatus: "completed" as const,
    serviceDate: "2025-02-08",
  },
  {
    id: "st2",
    facilityName: "あおぞらケアホーム",
    merchantName: "さくら訪問看護ステーション",
    serviceType: "nursing" as const,
    residentName: "鈴木 花子",
    selfPayAmount: 8200,
    paymentStatus: "pending" as const,
    serviceDate: "2025-02-09",
  },
  {
    id: "st3",
    facilityName: "さくら介護施設",
    merchantName: "東京介護タクシー",
    serviceType: "taxi" as const,
    residentName: "田中 一郎",
    selfPayAmount: 3800,
    paymentStatus: "failed" as const,
    serviceDate: "2025-02-10",
  },
];

const recentNotifications = [
  { id: "n1", title: "決済失敗：田中 一郎様（東京介護タクシー）カード有効期限切れ", type: "system" as const, time: "5分前" },
  { id: "n2", title: "明細アップロード：田中内科クリニック 12件", type: "statement" as const, time: "1時間前" },
  { id: "n3", title: "2月分領収書 自動発行完了（32件）", type: "receipt" as const, time: "3時間前" },
];

const notificationTypeColors: Record<string, string> = {
  statement: "bg-blue-100 text-blue-800",
  receipt: "bg-purple-100 text-purple-800",
  system: "bg-red-100 text-red-800",
};

const notificationTypeLabels: Record<string, string> = {
  statement: "明細",
  receipt: "領収書",
  system: "システム",
};

// --- コンポーネント ---

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">ダッシュボード</h2>
        <p className="mt-1 text-sm text-gray-500">QOLC運営管理 - 全体の利用状況</p>
      </div>

      {/* 【1. 統計カード】 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">登録施設数</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{overallStats.facilities}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">登録加盟店数</p>
            <p className="text-2xl font-bold mt-1 text-indigo-600">{overallStats.merchants}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">登録入居者数</p>
            <p className="text-2xl font-bold mt-1 text-purple-600">{overallStats.residents.toLocaleString()}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">今月の決済額</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(overallStats.monthlyPaymentTotal)}</p>
          </CardBody>
        </Card>
      </div>

      {/* 【2. アラート表示】 */}
      <div className="space-y-2 mb-8">
        {alerts.map((alert) => (
          <Link
            key={alert.id}
            href={alert.link}
            className={`flex items-center gap-3 p-3 rounded-lg border hover:shadow-sm transition-shadow ${
              alert.type === "error"
                ? "border-red-300 bg-red-50"
                : "border-yellow-300 bg-yellow-50"
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              alert.type === "error" ? "bg-red-500" : "bg-yellow-500"
            }`} />
            <span className="text-sm font-medium text-gray-900">{alert.message}</span>
            <span className="ml-auto text-xs text-blue-600 whitespace-nowrap">詳細を見る &rarr;</span>
          </Link>
        ))}
      </div>

      {/* 【3. 外部システム状況】 / 【4. 最近のアクティビティ】 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 外部システム状況（左側） */}
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">外部システム状況</h3>
            <div className="space-y-3">
              {externalSystems.map((sys) => {
                const config = systemStatusConfig[sys.status];
                return (
                  <div key={sys.id} className={`flex items-center justify-between p-3 rounded-lg ${config.color}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-base">{config.icon}</span>
                      <span className="text-sm font-medium">{sys.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">最終通信: {sys.lastCommunication}</span>
                      <span className="text-xs font-medium">{config.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* 最近のアクティビティ（右側） */}
        <div className="space-y-6">
          {/* 最近の明細アップロード */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">最近の明細アップロード</h3>
                <Link href="/payments" className="text-sm text-blue-600 hover:text-blue-800">決済管理へ</Link>
              </div>
              <div className="space-y-3">
                {recentStatements.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.residentName}</p>
                      <p className="text-xs text-gray-500">
                        {s.merchantName}（{SERVICE_TYPE_LABELS[s.serviceType]}）/ {s.facilityName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {formatCurrency(s.selfPayAmount)}
                      </span>
                      <Badge className={PAYMENT_STATUS_COLORS[s.paymentStatus]}>
                        {PAYMENT_STATUS_LABELS[s.paymentStatus]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* 最近の通知 */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">最近の通知</h3>
                <Link href="/notifications" className="text-sm text-blue-600 hover:text-blue-800">通知管理へ</Link>
              </div>
              <div className="space-y-3">
                {recentNotifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={notificationTypeColors[n.type]}>{notificationTypeLabels[n.type]}</Badge>
                      </div>
                      <p className="text-sm text-gray-900">{n.title}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{n.time}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
