"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import FileUpload from "@/components/ui/FileUpload";
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
} from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Statement } from "@/lib/types";

// ダミーデータ（後でAPIに置き換え）
const dummyStatements: Statement[] = [
  {
    id: "st1",
    merchantId: "m1",
    merchantName: "田中内科クリニック",
    residentId: "r1",
    residentName: "山田 太郎",
    facilityId: "fac1",
    facilityName: "さくら介護施設",
    serviceDate: "2025-02-08",
    items: [
      { description: "訪問診療（初診）", unitCount: 1, unitPrice: 10000, amount: 10000 },
      { description: "処方箋料", unitCount: 1, unitPrice: 2500, amount: 2500 },
    ],
    totalAmount: 12500,
    insuranceAmount: 0,
    selfPayAmount: 12500,
    paymentStatus: "completed",
    paymentDate: "2025-02-08",
    usenTransactionId: "USN-20250208-001",
    uploadedAt: "2025-02-08T10:00:00Z",
    createdAt: "2025-02-08T10:00:00Z",
    updatedAt: "2025-02-08T10:00:00Z",
  },
  {
    id: "st2",
    merchantId: "m2",
    merchantName: "さくら訪問看護ステーション",
    residentId: "r2",
    residentName: "鈴木 花子",
    facilityId: "fac2",
    facilityName: "あおぞらケアホーム",
    serviceDate: "2025-02-09",
    items: [
      { description: "訪問看護（60分）", unitCount: 2, unitPrice: 4100, amount: 8200 },
    ],
    totalAmount: 8200,
    insuranceAmount: 0,
    selfPayAmount: 8200,
    paymentStatus: "pending",
    uploadedAt: "2025-02-09T14:00:00Z",
    createdAt: "2025-02-09T14:00:00Z",
    updatedAt: "2025-02-09T14:00:00Z",
  },
  {
    id: "st3",
    merchantId: "m3",
    merchantName: "東京介護タクシー",
    residentId: "r3",
    residentName: "田中 一郎",
    facilityId: "fac1",
    facilityName: "さくら介護施設",
    serviceDate: "2025-02-10",
    items: [
      { description: "介護タクシー利用", unitCount: 1, unitPrice: 3800, amount: 3800 },
    ],
    totalAmount: 3800,
    insuranceAmount: 0,
    selfPayAmount: 3800,
    paymentStatus: "failed",
    uploadedAt: "2025-02-10T09:00:00Z",
    createdAt: "2025-02-10T09:00:00Z",
    updatedAt: "2025-02-10T09:00:00Z",
  },
  {
    id: "st4",
    merchantId: "m4",
    merchantName: "やまと訪問歯科",
    residentId: "r4",
    residentName: "佐藤 美智子",
    facilityId: "fac3",
    facilityName: "ひまわり老人ホーム",
    serviceDate: "2025-02-07",
    items: [
      { description: "訪問歯科診療", unitCount: 1, unitPrice: 5000, amount: 5000 },
      { description: "義歯調整", unitCount: 1, unitPrice: 3000, amount: 3000 },
    ],
    totalAmount: 8000,
    insuranceAmount: 0,
    selfPayAmount: 8000,
    paymentStatus: "completed",
    paymentDate: "2025-02-07",
    uploadedAt: "2025-02-07T16:00:00Z",
    createdAt: "2025-02-07T16:00:00Z",
    updatedAt: "2025-02-07T16:00:00Z",
  },
];

export default function StatementsPage() {
  const [showUpload, setShowUpload] = useState(false);

  const handleFileSelect = (file: File) => {
    console.log("Selected file:", file.name);
    // TODO: ファイルアップロード処理
  };

  return (
    <div>
      <Header
        title="明細管理"
        description="利用明細のアップロード・管理を行います"
        actions={
          <Button onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? "閉じる" : "明細アップロード"}
          </Button>
        }
      />

      {showUpload && (
        <Card className="mb-6">
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              明細ファイルをアップロード
            </h3>
            <FileUpload onFileSelect={handleFileSelect} />
            <div className="mt-4 flex justify-end">
              <Button disabled>アップロード</Button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>サービス日</TableHeader>
              <TableHeader>入居者</TableHeader>
              <TableHeader>加盟店（サービス種別）</TableHeader>
              <TableHeader>施設</TableHeader>
              <TableHeader>自己負担額</TableHeader>
              <TableHeader>決済状況</TableHeader>
              <TableHeader>操作</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {dummyStatements.map((statement) => (
              <TableRow key={statement.id}>
                <TableCell>
                  {formatDate(statement.serviceDate)}
                </TableCell>
                <TableCell className="font-medium">{statement.residentName}</TableCell>
                <TableCell>{statement.merchantName}</TableCell>
                <TableCell>{statement.facilityName}</TableCell>
                <TableCell>{formatCurrency(statement.selfPayAmount)}</TableCell>
                <TableCell>
                  <Badge className={PAYMENT_STATUS_COLORS[statement.paymentStatus]}>
                    {PAYMENT_STATUS_LABELS[statement.paymentStatus]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/statements/${statement.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    詳細
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
