"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table, {
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/Table";
import { formatCurrency } from "@/lib/utils";
import type { Receipt } from "@/lib/types";

// ダミーデータ
const dummyReceipts: (Receipt & { issueStatus: string; errorMessage?: string })[] = [
  {
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
    pdfUrl: "/receipts/RCP-2025-0001.pdf",
    createdAt: "2025-02-01T00:00:00Z",
    issueStatus: "issued",
  },
  {
    id: "rec2",
    receiptNumber: "RCP-2025-0002",
    residentId: "r2",
    residentName: "鈴木 花子",
    facilityId: "fac2",
    facilityName: "あおぞらケアホーム",
    merchantId: "m2",
    merchantName: "さくら訪問看護ステーション",
    periodStart: "2025-01-01",
    periodEnd: "2025-01-31",
    statementIds: ["st2", "st6"],
    totalAmount: 16400,
    issuedAt: "2025-02-01T00:00:00Z",
    createdAt: "2025-02-01T00:00:00Z",
    issueStatus: "issued",
  },
  {
    id: "rec3",
    receiptNumber: "RCP-2025-0003",
    residentId: "r4",
    residentName: "佐藤 美智子",
    facilityId: "fac3",
    facilityName: "ひまわり老人ホーム",
    merchantId: "m4",
    merchantName: "やまと訪問歯科",
    periodStart: "2025-01-01",
    periodEnd: "2025-01-31",
    statementIds: ["st4"],
    totalAmount: 8000,
    issuedAt: "2025-02-01T00:00:00Z",
    pdfUrl: "/receipts/RCP-2025-0003.pdf",
    downloadedAt: "2025-02-03T14:00:00Z",
    createdAt: "2025-02-01T00:00:00Z",
    issueStatus: "issued",
  },
  {
    id: "rec4",
    receiptNumber: "",
    residentId: "r5",
    residentName: "伊藤 正男",
    facilityId: "fac1",
    facilityName: "さくら介護施設",
    merchantId: "m3",
    merchantName: "東京介護タクシー",
    periodStart: "2025-01-01",
    periodEnd: "2025-01-31",
    statementIds: ["st3"],
    totalAmount: 3800,
    issuedAt: "",
    createdAt: "2025-02-01T00:00:00Z",
    issueStatus: "error",
    errorMessage: "未決済の明細が含まれているため発行不可",
  },
];

const issueStatusLabels: Record<string, string> = {
  issued: "発行済み",
  error: "発行エラー",
};

const issueStatusColors: Record<string, string> = {
  issued: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

type Tab = "all" | "errors";

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日〜${e.getMonth() + 1}月${e.getDate()}日`;
}

export default function ReceiptsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("");

  const facilities = useMemo(() => {
    const map = new Map<string, string>();
    dummyReceipts.forEach((r) => { if (r.facilityName) map.set(r.facilityId, r.facilityName); });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, []);

  const merchants = useMemo(() => {
    const map = new Map<string, string>();
    dummyReceipts.forEach((r) => { if (r.merchantName) map.set(r.merchantId, r.merchantName); });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, []);

  const filtered = useMemo(() => {
    let result = dummyReceipts;
    if (tab === "errors") result = result.filter((r) => r.issueStatus === "error");
    if (facilityFilter) result = result.filter((r) => r.facilityId === facilityFilter);
    if (merchantFilter) result = result.filter((r) => r.merchantId === merchantFilter);
    return result;
  }, [tab, facilityFilter, merchantFilter]);

  const filteredTotal = filtered.reduce((sum, r) => sum + r.totalAmount, 0);
  const errorCount = dummyReceipts.filter((r) => r.issueStatus === "error").length;
  const issuedCount = dummyReceipts.filter((r) => r.issueStatus === "issued").length;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "all", label: "すべて" },
    { key: "errors", label: "発行エラー", count: errorCount },
  ];

  return (
    <div>
      <Header
        title="領収書管理"
        description="領収書の発行状況・エラー確認を行います"
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">今月の発行数</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{dummyReceipts.length}件</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">発行済み</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{issuedCount}件</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">発行エラー</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{errorCount}件</p>
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-1 mb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                tab === t.key ? "bg-blue-500 text-white" : "bg-red-100 text-red-700"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">絞り込み:</span>
        <select
          value={facilityFilter}
          onChange={(e) => setFacilityFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">すべての施設</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <select
          value={merchantFilter}
          onChange={(e) => setMerchantFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">すべての加盟店</option>
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <Card>
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">{filtered.length}件表示</p>
          <p className="text-sm font-medium text-gray-700">合計: {formatCurrency(filteredTotal)}</p>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>領収書番号</TableHeader>
              <TableHeader>入居者</TableHeader>
              <TableHeader>加盟店</TableHeader>
              <TableHeader>施設</TableHeader>
              <TableHeader>対象期間</TableHeader>
              <TableHeader>金額</TableHeader>
              <TableHeader>状況</TableHeader>
              <TableHeader>操作</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                  該当するデータがありません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-medium">
                    {receipt.receiptNumber || "-"}
                  </TableCell>
                  <TableCell>{receipt.residentName}</TableCell>
                  <TableCell>{receipt.merchantName}</TableCell>
                  <TableCell>{receipt.facilityName}</TableCell>
                  <TableCell>
                    <span className="text-xs">{formatPeriod(receipt.periodStart, receipt.periodEnd)}</span>
                  </TableCell>
                  <TableCell>{formatCurrency(receipt.totalAmount)}</TableCell>
                  <TableCell>
                    <div>
                      <Badge className={issueStatusColors[receipt.issueStatus]}>
                        {issueStatusLabels[receipt.issueStatus]}
                      </Badge>
                      {receipt.errorMessage && (
                        <p className="text-xs text-red-500 mt-1 whitespace-normal">{receipt.errorMessage}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {receipt.issueStatus === "issued" ? (
                      <div className="flex gap-2">
                        <Link href={`/receipts/${receipt.id}`} className="text-blue-600 hover:text-blue-800 text-sm">
                          詳細
                        </Link>
                        {receipt.pdfUrl && (
                          <button className="text-green-600 hover:text-green-800 text-sm">PDF</button>
                        )}
                      </div>
                    ) : (
                      <button className="text-blue-600 hover:text-blue-800 text-sm">再発行</button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
