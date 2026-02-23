"use client";

import Link from "next/link";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Table, {
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/Table";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  UPLOAD_STATUS_LABELS,
  UPLOAD_STATUS_COLORS,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

// --- ダミーデータ ---

const uploadDetail = {
  id: "u1",
  uploadedAt: "2025-02-10 14:30",
  facilityName: "さくら介護施設",
  fileName: "2月分明細_田中内科.csv",
  recordCount: 45,
  totalAmount: 567800,
  status: "completed" as const,
};

const statementDetails = [
  {
    id: "s1",
    residentName: "山田 太郎",
    serviceDate: "2025-02-01",
    itemDescription: "初診料",
    amount: 2820,
    selfPayAmount: 850,
    paymentStatus: "completed" as const,
  },
  {
    id: "s2",
    residentName: "鈴木 花子",
    serviceDate: "2025-02-01",
    itemDescription: "再診料",
    amount: 730,
    selfPayAmount: 220,
    paymentStatus: "completed" as const,
  },
  {
    id: "s3",
    residentName: "佐藤 一郎",
    serviceDate: "2025-02-03",
    itemDescription: "訪問診療料",
    amount: 8880,
    selfPayAmount: 2660,
    paymentStatus: "pending" as const,
  },
  {
    id: "s4",
    residentName: "高橋 美咲",
    serviceDate: "2025-02-05",
    itemDescription: "再診料 + 処方箋料",
    amount: 1420,
    selfPayAmount: 430,
    paymentStatus: "completed" as const,
  },
  {
    id: "s5",
    residentName: "中村 健太",
    serviceDate: "2025-02-07",
    itemDescription: "訪問診療料",
    amount: 8880,
    selfPayAmount: 2660,
    paymentStatus: "failed" as const,
  },
];

export default function HistoryDetailPage() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/provider/history">
          <Button variant="ghost" size="sm">
            &larr; 戻る
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">アップロード詳細</h2>
          <p className="mt-1 text-sm text-gray-500">{uploadDetail.fileName}</p>
        </div>
      </div>

      {/* アップロード情報 */}
      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-gray-500">アップロード日時</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{uploadDetail.uploadedAt}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">施設名</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{uploadDetail.facilityName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ファイル名</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{uploadDetail.fileName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">件数</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{uploadDetail.recordCount}件</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">合計金額</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{formatCurrency(uploadDetail.totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ステータス</p>
              <div className="mt-1">
                <Badge className={UPLOAD_STATUS_COLORS[uploadDetail.status]}>
                  {UPLOAD_STATUS_LABELS[uploadDetail.status]}
                </Badge>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 明細一覧 */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">明細一覧</h3>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>入居者名</TableHeader>
                <TableHeader>サービス日</TableHeader>
                <TableHeader>サービス内容</TableHeader>
                <TableHeader>金額</TableHeader>
                <TableHeader>自己負担額</TableHeader>
                <TableHeader>決済ステータス</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {statementDetails.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.residentName}</TableCell>
                  <TableCell>{s.serviceDate}</TableCell>
                  <TableCell>{s.itemDescription}</TableCell>
                  <TableCell>{formatCurrency(s.amount)}</TableCell>
                  <TableCell>{formatCurrency(s.selfPayAmount)}</TableCell>
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
    </div>
  );
}
