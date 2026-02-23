"use client";

import { useState } from "react";
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
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_COLORS } from "@/lib/constants";

// --- ダミーデータ ---

const residents = [
  { id: "r1", name: "山田 太郎", nameKana: "ヤマダ タロウ", insuranceNumber: "****1234", admissionDate: "2023-04-01", selfAccount: true, familyCount: 2, notifyMethod: "LINE", cardRegistered: true, cardBrand: "Visa", cardLast4: "1234", status: "active" as const },
  { id: "r2", name: "鈴木 花子", nameKana: "スズキ ハナコ", insuranceNumber: "****5678", admissionDate: "2023-06-15", selfAccount: true, familyCount: 1, notifyMethod: "メール", cardRegistered: true, cardBrand: "Mastercard", cardLast4: "5678", status: "active" as const },
  { id: "r3", name: "佐藤 一郎", nameKana: "サトウ イチロウ", insuranceNumber: "****9012", admissionDate: "2023-09-01", selfAccount: false, familyCount: 3, notifyMethod: "LINE", cardRegistered: false, cardBrand: null, cardLast4: null, status: "active" as const },
  { id: "r4", name: "高橋 美咲", nameKana: "タカハシ ミサキ", insuranceNumber: "****3456", admissionDate: "2024-01-10", selfAccount: true, familyCount: 0, notifyMethod: "郵送", cardRegistered: false, cardBrand: null, cardLast4: null, status: "active" as const },
  { id: "r5", name: "中村 健太", nameKana: "ナカムラ ケンタ", insuranceNumber: "****7890", admissionDate: "2022-11-20", selfAccount: true, familyCount: 1, notifyMethod: "メール", cardRegistered: true, cardBrand: "Visa", cardLast4: "7890", status: "active" as const },
  { id: "r6", name: "渡辺 洋子", nameKana: "ワタナベ ヨウコ", insuranceNumber: "****2345", admissionDate: "2023-03-01", selfAccount: false, familyCount: 1, notifyMethod: "LINE", cardRegistered: true, cardBrand: "JCB", cardLast4: "2345", status: "discharged" as const },
];

export default function ResidentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = residents.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search && !r.name.includes(search) && !r.nameKana.includes(search) && !r.insuranceNumber.includes(search)) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">入居者管理</h2>
          <p className="mt-1 text-sm text-gray-500">入居者の一覧・管理</p>
        </div>
        <Link href="/facility/residents/new">
          <Button>入居者を登録</Button>
        </Link>
      </div>

      {/* フィルター */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="氏名・被保険者番号で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">すべて</option>
                <option value="active">入居中</option>
                <option value="discharged">退去済み</option>
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
                <TableHeader>入居者名</TableHeader>
                <TableHeader>被保険者番号</TableHeader>
                <TableHeader>入居日</TableHeader>
                <TableHeader>アカウント</TableHeader>
                <TableHeader>通知方法</TableHeader>
                <TableHeader>カード登録</TableHeader>
                <TableHeader>ステータス</TableHeader>
                <TableHeader>操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.nameKana}</p>
                    </div>
                  </TableCell>
                  <TableCell>{r.insuranceNumber}</TableCell>
                  <TableCell>{r.admissionDate}</TableCell>
                  <TableCell>
                    {(() => {
                      const total = (r.selfAccount ? 1 : 0) + r.familyCount;
                      const parts = [];
                      if (r.selfAccount) parts.push("本人");
                      if (r.familyCount > 0) parts.push(`家族${r.familyCount}名`);
                      return `${total}名（${parts.join(" + ")}）`;
                    })()}
                  </TableCell>
                  <TableCell>{r.notifyMethod}</TableCell>
                  <TableCell>
                    {r.cardRegistered ? (
                      <div>
                        <Badge className="bg-green-100 text-green-800">登録済み</Badge>
                        <p className="text-xs text-gray-500 mt-0.5">{r.cardBrand} •••• {r.cardLast4}</p>
                      </div>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">未登録</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={RESIDENT_STATUS_COLORS[r.status]}>
                      {RESIDENT_STATUS_LABELS[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/facility/residents/${r.id}`}
                      className="text-sm text-emerald-600 hover:text-emerald-800"
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
