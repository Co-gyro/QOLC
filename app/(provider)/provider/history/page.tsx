"use client";

import { useState } from "react";
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

const uploadHistory = [
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

export default function HistoryPage() {
  const [periodFilter, setPeriodFilter] = useState("this_month");
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">アップロード履歴</h2>
        <p className="mt-1 text-sm text-gray-500">過去のアップロード一覧</p>
      </div>

      {/* フィルター */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">期間</label>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="this_month">今月</option>
                <option value="last_month">先月</option>
                <option value="all">すべて</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">施設</label>
              <select
                value={facilityFilter}
                onChange={(e) => setFacilityFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">すべて</option>
                <option value="f1">さくら介護施設</option>
                <option value="f2">あおぞらケアホーム</option>
                <option value="f3">ひまわりシニアハウス</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ステータス</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">すべて</option>
                <option value="completed">完了</option>
                <option value="partial_error">一部エラー</option>
                <option value="error">エラー</option>
                <option value="processing">処理中</option>
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 一覧テーブル */}
      <Card>
        <CardBody>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>日時</TableHeader>
                <TableHeader>施設名</TableHeader>
                <TableHeader>ファイル名</TableHeader>
                <TableHeader>件数</TableHeader>
                <TableHeader>金額</TableHeader>
                <TableHeader>ステータス</TableHeader>
                <TableHeader>詳細</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploadHistory.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell>{upload.uploadedAt}</TableCell>
                  <TableCell>{upload.facilityName}</TableCell>
                  <TableCell className="font-medium">{upload.fileName}</TableCell>
                  <TableCell>{upload.recordCount}件</TableCell>
                  <TableCell>{formatCurrency(upload.totalAmount)}</TableCell>
                  <TableCell>
                    <Badge className={UPLOAD_STATUS_COLORS[upload.status]}>
                      {UPLOAD_STATUS_LABELS[upload.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/provider/history/${upload.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      詳細
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
