import Header from "@/components/layout/Header";
import Card, { CardHeader, CardBody } from "@/components/ui/Card";
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
  SERVICE_TYPE_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

// ダミーデータ（後でAPIに置き換え）
const dummyStatement = {
  id: "st1",
  merchantId: "m1",
  merchantName: "田中内科クリニック",
  serviceType: "medical" as const,
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
  paymentStatus: "completed" as const,
  paymentDate: "2025-02-08",
  usenTransactionId: "USN-20250208-001",
  uploadedAt: "2025-02-08T10:00:00Z",
};

export default function StatementDetailPage() {
  return (
    <div>
      <Header
        title="明細詳細"
        description={`${dummyStatement.residentName} - ${SERVICE_TYPE_LABELS[dummyStatement.serviceType]}`}
        actions={
          <div className="flex gap-3">
            <Link href="/statements">
              <Button variant="secondary">戻る</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody>
            <p className="text-xs text-gray-500">入居者</p>
            <p className="text-lg font-medium">{dummyStatement.residentName}</p>
            <p className="text-xs text-gray-400 mt-1">{dummyStatement.facilityName}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-gray-500">加盟店</p>
            <p className="text-lg font-medium">{dummyStatement.merchantName}</p>
            <p className="text-xs text-gray-400 mt-1">{SERVICE_TYPE_LABELS[dummyStatement.serviceType]}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-gray-500">決済状況</p>
            <div className="mt-1">
              <Badge className={PAYMENT_STATUS_COLORS[dummyStatement.paymentStatus]}>
                {PAYMENT_STATUS_LABELS[dummyStatement.paymentStatus]}
              </Badge>
            </div>
            {dummyStatement.usenTransactionId && (
              <p className="text-xs text-gray-400 mt-2">TX: {dummyStatement.usenTransactionId}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-gray-500">自己負担額</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(dummyStatement.selfPayAmount)}
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardBody>
            <p className="text-xs text-gray-500">サービス提供日</p>
            <p className="text-sm font-medium">{formatDate(dummyStatement.serviceDate)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-gray-500">合計金額</p>
            <p className="text-sm font-medium">{formatCurrency(dummyStatement.totalAmount)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-gray-500">保険適用額</p>
            <p className="text-sm font-medium">{formatCurrency(dummyStatement.insuranceAmount)}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">明細項目</h3>
        </CardHeader>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>サービス内容</TableHeader>
              <TableHeader>単位数</TableHeader>
              <TableHeader>単価</TableHeader>
              <TableHeader>金額</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {dummyStatement.items.map((item, i) => (
              <TableRow key={i}>
                <TableCell>{item.description}</TableCell>
                <TableCell>{item.unitCount}</TableCell>
                <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                <TableCell>{formatCurrency(item.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-gray-50">
              <TableCell className="font-semibold">合計</TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="font-semibold">{formatCurrency(dummyStatement.totalAmount)}</TableCell>
            </TableRow>
            <TableRow className="bg-gray-50">
              <TableCell>保険適用額</TableCell>
              <TableCell />
              <TableCell />
              <TableCell>{formatCurrency(dummyStatement.insuranceAmount)}</TableCell>
            </TableRow>
            <TableRow className="bg-blue-50 font-bold">
              <TableCell>自己負担額</TableCell>
              <TableCell />
              <TableCell />
              <TableCell>{formatCurrency(dummyStatement.selfPayAmount)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
