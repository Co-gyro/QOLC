"use client";

import { useState, useMemo } from "react";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table, {
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/Table";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, NOTIFY_STATUS_LABELS, NOTIFY_STATUS_COLORS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

// --- ダミーデータ ---

const statements = [
  // 2月
  { id: "s1", serviceDate: "2025-02-10", residentName: "山田 太郎", providerName: "田中内科クリニック", description: "初診料", amount: 2820, selfPayAmount: 850, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s2", serviceDate: "2025-02-10", residentName: "鈴木 花子", providerName: "さくら薬局", description: "調剤料", amount: 1540, selfPayAmount: 460, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s3", serviceDate: "2025-02-08", residentName: "佐藤 一郎", providerName: "田中内科クリニック", description: "訪問診療料", amount: 8880, selfPayAmount: 2660, paymentStatus: "pending" as const, notifyStatus: "pending" as const },
  { id: "s4", serviceDate: "2025-02-07", residentName: "高橋 美咲", providerName: "あおぞらタクシー", description: "通院送迎", amount: 3200, selfPayAmount: 3200, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s5", serviceDate: "2025-02-06", residentName: "中村 健太", providerName: "田中内科クリニック", description: "訪問診療料", amount: 8880, selfPayAmount: 2660, paymentStatus: "failed" as const, notifyStatus: "pending" as const },
  { id: "s6", serviceDate: "2025-02-05", residentName: "伊藤 裕子", providerName: "さくら薬局", description: "調剤料", amount: 980, selfPayAmount: 290, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s7", serviceDate: "2025-02-03", residentName: "渡辺 洋子", providerName: "やまと訪問歯科", description: "訪問歯科診療", amount: 4500, selfPayAmount: 1350, paymentStatus: "completed" as const, notifyStatus: "failed" as const },
  { id: "s8", serviceDate: "2025-02-01", residentName: "山田 太郎", providerName: "あおぞらタクシー", description: "通院送迎", amount: 2800, selfPayAmount: 2800, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  // 1月
  { id: "s9", serviceDate: "2025-01-28", residentName: "山田 太郎", providerName: "田中内科クリニック", description: "再診料", amount: 730, selfPayAmount: 220, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s10", serviceDate: "2025-01-25", residentName: "鈴木 花子", providerName: "田中内科クリニック", description: "訪問診療料", amount: 8880, selfPayAmount: 2660, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s11", serviceDate: "2025-01-20", residentName: "佐藤 一郎", providerName: "さくら薬局", description: "調剤料", amount: 1240, selfPayAmount: 370, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s12", serviceDate: "2025-01-15", residentName: "高橋 美咲", providerName: "やまと訪問歯科", description: "訪問歯科診療", amount: 3800, selfPayAmount: 1140, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s13", serviceDate: "2025-01-10", residentName: "中村 健太", providerName: "あおぞらタクシー", description: "通院送迎", amount: 2400, selfPayAmount: 2400, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
  { id: "s14", serviceDate: "2025-01-05", residentName: "伊藤 裕子", providerName: "田中内科クリニック", description: "再診料 + 処方箋料", amount: 1420, selfPayAmount: 430, paymentStatus: "completed" as const, notifyStatus: "sent" as const },
];

// 選択肢をデータから動的に生成
const uniqueResidents = Array.from(new Set(statements.map((s) => s.residentName)));
const uniqueProviders = Array.from(new Set(statements.map((s) => s.providerName)));

// 期間の判定用ヘルパー
function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, end };
}

export default function StatementsPage() {
  // 基準日: 2025-02（ダミーデータに合わせる）
  const baseYear = 2025;
  const baseMonth = 2;

  const [periodFilter, setPeriodFilter] = useState("this_month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [residentFilter, setResidentFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return statements.filter((s) => {
      // 期間フィルター
      if (periodFilter === "this_month") {
        const { start, end } = getMonthRange(baseYear, baseMonth);
        if (s.serviceDate < start || s.serviceDate >= end) return false;
      } else if (periodFilter === "last_month") {
        const lastMonth = baseMonth === 1 ? 12 : baseMonth - 1;
        const lastYear = baseMonth === 1 ? baseYear - 1 : baseYear;
        const { start, end } = getMonthRange(lastYear, lastMonth);
        if (s.serviceDate < start || s.serviceDate >= end) return false;
      } else if (periodFilter === "custom") {
        if (customStartDate && s.serviceDate < customStartDate) return false;
        if (customEndDate && s.serviceDate > customEndDate) return false;
      }

      // 入居者フィルター
      if (residentFilter !== "all" && s.residentName !== residentFilter) return false;

      // サービス提供者フィルター
      if (providerFilter !== "all" && s.providerName !== providerFilter) return false;

      // ステータスフィルター
      if (statusFilter !== "all" && s.paymentStatus !== statusFilter) return false;

      return true;
    });
  }, [periodFilter, customStartDate, customEndDate, residentFilter, providerFilter, statusFilter]);

  const totalCount = filtered.length;
  const totalAmount = filtered.reduce((sum, s) => sum + s.selfPayAmount, 0);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">明細確認</h2>
        <p className="mt-1 text-sm text-gray-500">施設全体の利用明細</p>
      </div>

      {/* フィルター */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">期間</label>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">すべて</option>
                <option value="this_month">今月</option>
                <option value="last_month">先月</option>
                <option value="custom">カスタム</option>
              </select>
            </div>
            {periodFilter === "custom" && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">開始日</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">終了日</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">入居者</label>
              <select
                value={residentFilter}
                onChange={(e) => setResidentFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">すべて</option>
                {uniqueResidents.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">サービス提供者</label>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">すべて</option>
                {uniqueProviders.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">決済ステータス</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">すべて</option>
                <option value="completed">決済完了</option>
                <option value="pending">未決済</option>
                <option value="failed">エラー</option>
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 集計 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardBody className="py-3 px-5">
            <p className="text-xs text-gray-500">合計件数</p>
            <p className="text-xl font-bold text-gray-900">{totalCount}件</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-5">
            <p className="text-xs text-gray-500">合計自己負担額</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
          </CardBody>
        </Card>
      </div>

      {/* 一覧テーブル */}
      <Card>
        <CardBody>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>サービス日</TableHeader>
                <TableHeader>入居者名</TableHeader>
                <TableHeader>サービス提供者</TableHeader>
                <TableHeader>サービス内容</TableHeader>
                <TableHeader>金額</TableHeader>
                <TableHeader>自己負担額</TableHeader>
                <TableHeader>決済</TableHeader>
                <TableHeader>通知</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                    該当する明細がありません
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.serviceDate}</TableCell>
                    <TableCell className="font-medium">{s.residentName}</TableCell>
                    <TableCell>{s.providerName}</TableCell>
                    <TableCell>{s.description}</TableCell>
                    <TableCell>{formatCurrency(s.amount)}</TableCell>
                    <TableCell>{formatCurrency(s.selfPayAmount)}</TableCell>
                    <TableCell>
                      <Badge className={PAYMENT_STATUS_COLORS[s.paymentStatus]}>
                        {PAYMENT_STATUS_LABELS[s.paymentStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={NOTIFY_STATUS_COLORS[s.notifyStatus]}>
                        {NOTIFY_STATUS_LABELS[s.notifyStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
