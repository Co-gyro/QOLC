import Header from "@/components/layout/Header";
import Card, { CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

// ダミーデータ
const dummyReceipt = {
  id: "rec1",
  receiptNumber: "RCP-2025-0001",
  residentId: "r1",
  residentName: "山田 太郎",
  facilityId: "fac1",
  facilityName: "さくら介護施設",
  merchantId: "m1",
  merchantName: "田中内科クリニック",
  periodStart: "2025-01-01",
  periodEnd: "2025-01-31",
  statementIds: ["st1", "st5", "st9"],
  totalAmount: 35000,
  issuedAt: "2025-02-01T00:00:00Z",
  items: [
    { date: "2025-01-08", description: "訪問診療（初診）", amount: 12500 },
    { date: "2025-01-15", description: "訪問診療（再診）", amount: 10000 },
    { date: "2025-01-22", description: "訪問診療（再診）+ 処方箋", amount: 12500 },
  ],
};

export default function ReceiptDetailPage() {
  return (
    <div>
      <Header
        title="領収書詳細"
        description={`領収書番号: ${dummyReceipt.receiptNumber}`}
        actions={
          <div className="flex gap-3">
            <Link href="/receipts">
              <Button variant="secondary">戻る</Button>
            </Link>
            <Button>PDFダウンロード</Button>
          </div>
        }
      />

      <Card className="max-w-2xl">
        <CardBody className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">領 収 書</h2>
            <p className="text-sm text-gray-500">
              No. {dummyReceipt.receiptNumber}
            </p>
          </div>

          <div className="border-b-2 border-gray-900 pb-4 mb-6">
            <p className="text-xl font-semibold">
              {dummyReceipt.residentName} 様
            </p>
            <p className="text-sm text-gray-500 mt-1">
              対象期間: {formatDate(dummyReceipt.periodStart)} 〜 {formatDate(dummyReceipt.periodEnd)}
            </p>
          </div>

          <div className="text-center mb-8">
            <p className="text-sm text-gray-500">合計金額</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">
              {formatCurrency(dummyReceipt.totalAmount)}
            </p>
          </div>

          <div className="mb-8">
            <h3 className="font-semibold text-gray-700 mb-3">内訳</h3>
            <div className="space-y-2">
              {dummyReceipt.items.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between py-2 border-b border-gray-100"
                >
                  <div>
                    <span className="text-sm text-gray-600">{item.description}</span>
                    <span className="text-xs text-gray-400 ml-2">({formatDate(item.date)})</span>
                  </div>
                  <span className="text-sm font-medium">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">発行日</span>
              <span>{formatDate(dummyReceipt.issuedAt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">サービス提供者</span>
              <span className="font-medium">{dummyReceipt.merchantName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">施設</span>
              <span>{dummyReceipt.facilityName}</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
