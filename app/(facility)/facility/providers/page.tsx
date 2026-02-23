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
import { SERVICE_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

// --- ダミーデータ ---

const linkedProviders = [
  { id: "p1", name: "田中内科クリニック", serviceType: "medical" as const, registeredAt: "2024-04-01", monthlyCount: 45, monthlyAmount: 567800, status: "active" as const },
  { id: "p2", name: "さくら薬局", serviceType: "pharmacy" as const, registeredAt: "2024-04-01", monthlyCount: 38, monthlyAmount: 234500, status: "active" as const },
  { id: "p3", name: "あおぞらタクシー", serviceType: "taxi" as const, registeredAt: "2024-06-15", monthlyCount: 12, monthlyAmount: 86400, status: "active" as const },
  { id: "p4", name: "やまと訪問歯科", serviceType: "dental" as const, registeredAt: "2024-09-01", monthlyCount: 8, monthlyAmount: 124000, status: "active" as const },
  { id: "p5", name: "みどり訪問看護", serviceType: "nursing" as const, registeredAt: "2024-03-01", monthlyCount: 0, monthlyAmount: 0, status: "inactive" as const },
];

export default function ProvidersPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">サービス提供者管理</h2>
          <p className="mt-1 text-sm text-gray-500">利用中のサービス提供者</p>
        </div>
        <Link href="/facility/providers/add">
          <Button>サービス提供者を追加</Button>
        </Link>
      </div>

      <Card>
        <CardBody>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>サービス提供者名</TableHeader>
                <TableHeader>サービス種別</TableHeader>
                <TableHeader>登録日</TableHeader>
                <TableHeader>今月の利用</TableHeader>
                <TableHeader>ステータス</TableHeader>
                <TableHeader>操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {linkedProviders.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{SERVICE_TYPE_LABELS[p.serviceType]}</TableCell>
                  <TableCell>{p.registeredAt}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{p.monthlyCount}件</p>
                      <p className="text-xs text-gray-500">{formatCurrency(p.monthlyAmount)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.status === "active" ? (
                      <Badge className="bg-green-100 text-green-800">有効</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800">無効</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {p.status === "active" ? (
                        <Button variant="ghost" size="sm">無効化</Button>
                      ) : (
                        <Button variant="ghost" size="sm">有効化</Button>
                      )}
                    </div>
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
