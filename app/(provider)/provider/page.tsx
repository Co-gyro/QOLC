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
import { UPLOAD_STATUS_LABELS, UPLOAD_STATUS_COLORS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

// --- ダミーデータ ---

const stats = {
  uploadCount: 127,
  completedAmount: 3456780,
  pendingCount: 3,
  expectedTransferAmount: 3234500,
};

const alerts = [
  { id: "a1", message: "決済エラー：2件の確認が必要です", link: "/provider/history" },
];

// 紐づけ済み施設
const linkedFacilities = [
  { id: "f1", name: "さくら介護施設", residentCount: 45, status: "active" as const },
  { id: "f2", name: "あおぞらケアホーム", residentCount: 32, status: "active" as const },
  { id: "f3", name: "ひまわりシニアハウス", residentCount: 28, status: "active" as const },
];

const recentUploads = [
  {
    id: "u1",
    uploadedAt: "2025-02-10 14:30",
    facilityName: "さくら介護施設",
    fileName: "2月分明細_田中内科.csv",
    recordCount: 45,
    totalAmount: 567800,
    status: "completed" as const,
  },
  {
    id: "u2",
    uploadedAt: "2025-02-08 10:15",
    facilityName: "あおぞらケアホーム",
    fileName: "2月分明細_田中内科_追加.csv",
    recordCount: 12,
    totalAmount: 145600,
    status: "completed" as const,
  },
  {
    id: "u3",
    uploadedAt: "2025-02-05 09:00",
    facilityName: "さくら介護施設",
    fileName: "1月分明細_田中内科.csv",
    recordCount: 38,
    totalAmount: 423500,
    status: "partial_error" as const,
  },
  {
    id: "u4",
    uploadedAt: "2025-02-01 16:45",
    facilityName: "ひまわりシニアハウス",
    fileName: "1月分明細_修正.csv",
    recordCount: 5,
    totalAmount: 62300,
    status: "completed" as const,
  },
  {
    id: "u5",
    uploadedAt: "2025-01-28 11:20",
    facilityName: "さくら介護施設",
    fileName: "1月分明細_田中内科.csv",
    recordCount: 42,
    totalAmount: 498700,
    status: "error" as const,
  },
];

// --- コンポーネント ---

export default function ProviderDashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">ダッシュボード</h2>
        <p className="mt-1 text-sm text-gray-500">田中内科クリニック - 利用状況</p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">今月のアップロード数</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{stats.uploadCount}件</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">決済完了額</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(stats.completedAmount)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">未決済件数</p>
            <p className="text-2xl font-bold mt-1 text-red-600">{stats.pendingCount}件</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">振込予定額</p>
            <p className="text-2xl font-bold mt-1 text-indigo-600">{formatCurrency(stats.expectedTransferAmount)}</p>
          </CardBody>
        </Card>
      </div>

      {/* アラート */}
      {alerts.length > 0 && (
        <div className="space-y-2 mb-8">
          {alerts.map((alert) => (
            <Link
              key={alert.id}
              href={alert.link}
              className="flex items-center gap-3 p-3 rounded-lg border border-yellow-300 bg-yellow-50 hover:shadow-sm transition-shadow"
            >
              <span className="w-2 h-2 rounded-full shrink-0 bg-yellow-500" />
              <span className="text-sm font-medium text-gray-900">{alert.message}</span>
              <span className="ml-auto text-xs text-blue-600 whitespace-nowrap">詳細を見る &rarr;</span>
            </Link>
          ))}
        </div>
      )}

      {/* サービス提供先施設（左） / 最近のアップロード（右） */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* サービス提供先施設 */}
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">サービス提供先施設</h3>
            <div className="space-y-3">
              {linkedFacilities.map((facility) => (
                <div
                  key={facility.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{facility.name}</p>
                    <p className="text-xs text-gray-500">入居者 {facility.residentCount}名</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">有効</Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* 最近のアップロード */}
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">最近のアップロード</h3>
              <Link href="/provider/history" className="text-sm text-blue-600 hover:text-blue-800">
                すべて見る
              </Link>
            </div>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>日時</TableHeader>
                  <TableHeader>施設名</TableHeader>
                  <TableHeader>ファイル名</TableHeader>
                  <TableHeader>件数</TableHeader>
                  <TableHeader>金額</TableHeader>
                  <TableHeader>ステータス</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentUploads.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell>{upload.uploadedAt}</TableCell>
                    <TableCell>{upload.facilityName}</TableCell>
                    <TableCell>
                      <Link href={`/provider/history/${upload.id}`} className="text-blue-600 hover:text-blue-800">
                        {upload.fileName}
                      </Link>
                    </TableCell>
                    <TableCell>{upload.recordCount}件</TableCell>
                    <TableCell>{formatCurrency(upload.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge className={UPLOAD_STATUS_COLORS[upload.status]}>
                        {UPLOAD_STATUS_LABELS[upload.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
