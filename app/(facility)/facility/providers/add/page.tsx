"use client";

import { useState } from "react";
import Link from "next/link";
import Card, { CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Table, {
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/Table";
import { SERVICE_TYPE_LABELS } from "@/lib/constants";

// --- ダミーデータ ---

const availableProviders = [
  { id: "ap1", name: "はなまる訪問診療所", serviceType: "medical" as const, address: "東京都新宿区西新宿1-2-3" },
  { id: "ap2", name: "きらら薬局", serviceType: "pharmacy" as const, address: "東京都渋谷区渋谷2-3-4" },
  { id: "ap3", name: "まごころケアサービス", serviceType: "care" as const, address: "東京都中野区中野5-6-7" },
  { id: "ap4", name: "ふたば歯科", serviceType: "dental" as const, address: "東京都杉並区高円寺南3-4-5" },
  { id: "ap5", name: "みらいタクシー", serviceType: "taxi" as const, address: "東京都練馬区練馬1-1-1" },
  { id: "ap6", name: "やすらぎ訪問看護ステーション", serviceType: "nursing" as const, address: "東京都世田谷区三軒茶屋2-3-4" },
];

export default function ProviderAddPage() {
  const [search, setSearch] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");

  const filtered = availableProviders.filter((p) => {
    if (serviceTypeFilter !== "all" && p.serviceType !== serviceTypeFilter) return false;
    if (search && !p.name.includes(search)) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/facility/providers">
          <Button variant="ghost" size="sm">
            &larr; 戻る
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">サービス提供者追加</h2>
          <p className="mt-1 text-sm text-gray-500">QOLCに登録済みのサービス提供者から選択</p>
        </div>
      </div>

      {/* 検索・フィルター */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="事業者名で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <select
                value={serviceTypeFilter}
                onChange={(e) => setServiceTypeFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">すべての種別</option>
                {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 一覧 */}
      <Card>
        <CardBody>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>サービス提供者名</TableHeader>
                <TableHeader>サービス種別</TableHeader>
                <TableHeader>住所</TableHeader>
                <TableHeader>操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{SERVICE_TYPE_LABELS[p.serviceType]}</TableCell>
                  <TableCell>{p.address}</TableCell>
                  <TableCell>
                    <Button size="sm">追加</Button>
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
