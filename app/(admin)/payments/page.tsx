"use client";

import { useState, useMemo } from "react";
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
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

type PaymentRecord = {
  id: string;
  residentName: string;
  merchantId: string;
  merchantName: string;
  facilityId: string;
  facilityName: string;
  selfPayAmount: number;
  paymentStatus: string;
  serviceDate: string;
  errorMessage?: string;
};

const dummyPayments: PaymentRecord[] = [
  { id: "p1", residentName: "山田 太郎", merchantId: "m1", merchantName: "田中内科クリニック", facilityId: "fac1", facilityName: "さくら介護施設", selfPayAmount: 12500, paymentStatus: "completed", serviceDate: "2025-02-08" },
  { id: "p2", residentName: "鈴木 花子", merchantId: "m2", merchantName: "さくら訪問看護ステーション", facilityId: "fac2", facilityName: "あおぞらケアホーム", selfPayAmount: 8200, paymentStatus: "pending", serviceDate: "2025-02-09" },
  { id: "p3", residentName: "田中 一郎", merchantId: "m3", merchantName: "東京介護タクシー", facilityId: "fac1", facilityName: "さくら介護施設", selfPayAmount: 3800, paymentStatus: "failed", serviceDate: "2025-02-10", errorMessage: "カード有効期限切れ" },
  { id: "p4", residentName: "佐藤 美智子", merchantId: "m4", merchantName: "やまと訪問歯科", facilityId: "fac3", facilityName: "ひまわり老人ホーム", selfPayAmount: 8000, paymentStatus: "completed", serviceDate: "2025-02-07" },
  { id: "p5", residentName: "高橋 健一", merchantId: "m1", merchantName: "田中内科クリニック", facilityId: "fac1", facilityName: "さくら介護施設", selfPayAmount: 10000, paymentStatus: "pending", serviceDate: "2025-02-10" },
  { id: "p6", residentName: "渡辺 節子", merchantId: "m2", merchantName: "さくら訪問看護ステーション", facilityId: "fac2", facilityName: "あおぞらケアホーム", selfPayAmount: 4100, paymentStatus: "failed", serviceDate: "2025-02-09", errorMessage: "残高不足" },
];

type Tab = "all" | "errors" | "pending";

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("");

  const facilities = useMemo(() => {
    const map = new Map<string, string>();
    dummyPayments.forEach((p) => map.set(p.facilityId, p.facilityName));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, []);

  const merchants = useMemo(() => {
    const map = new Map<string, string>();
    dummyPayments.forEach((p) => map.set(p.merchantId, p.merchantName));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, []);

  const filtered = useMemo(() => {
    let result = dummyPayments;
    if (tab === "errors") result = result.filter((p) => p.paymentStatus === "failed");
    if (tab === "pending") result = result.filter((p) => p.paymentStatus === "pending");
    if (facilityFilter) result = result.filter((p) => p.facilityId === facilityFilter);
    if (merchantFilter) result = result.filter((p) => p.merchantId === merchantFilter);
    return result;
  }, [tab, facilityFilter, merchantFilter]);

  const filteredTotal = filtered.reduce((sum, p) => sum + p.selfPayAmount, 0);
  const errorCount = dummyPayments.filter((p) => p.paymentStatus === "failed").length;
  const pendingCount = dummyPayments.filter((p) => p.paymentStatus === "pending").length;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "all", label: "すべて" },
    { key: "errors", label: "決済エラー", count: errorCount },
    { key: "pending", label: "未決済", count: pendingCount },
  ];

  return (
    <div>
      <Header
        title="決済管理"
        description="決済状況の確認・エラー対応を行います"
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">今月の決済総額</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(1250000)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">未決済件数</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{pendingCount}件</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">決済エラー</p>
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
              <TableHeader>サービス日</TableHeader>
              <TableHeader>入居者</TableHeader>
              <TableHeader>加盟店</TableHeader>
              <TableHeader>施設</TableHeader>
              <TableHeader>金額</TableHeader>
              <TableHeader>状況</TableHeader>
              {tab === "errors" && <TableHeader>エラー内容</TableHeader>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tab === "errors" ? 7 : 6} className="text-center text-gray-400 py-8">
                  該当するデータがありません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.serviceDate)}</TableCell>
                  <TableCell className="font-medium">{p.residentName}</TableCell>
                  <TableCell>{p.merchantName}</TableCell>
                  <TableCell>{p.facilityName}</TableCell>
                  <TableCell>{formatCurrency(p.selfPayAmount)}</TableCell>
                  <TableCell>
                    <Badge className={PAYMENT_STATUS_COLORS[p.paymentStatus]}>
                      {PAYMENT_STATUS_LABELS[p.paymentStatus]}
                    </Badge>
                  </TableCell>
                  {tab === "errors" && (
                    <TableCell className="text-sm text-red-600">{p.errorMessage}</TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
