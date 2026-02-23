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
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

// --- ダミーデータ ---

const resident = {
  id: "r1",
  lastName: "山田",
  firstName: "太郎",
  lastNameKana: "ヤマダ",
  firstNameKana: "タロウ",
  birthDate: "1940-03-15",
  gender: "男性",
  insuranceNumber: "0123456789",
  admissionDate: "2023-04-01",
  roomNumber: "201",
  notes: "特になし",
  status: "active" as const,
  cardRegistered: true,
  cardBrand: "Visa",
  cardLast4: "1234",
};

const accounts = [
  { id: "a1", type: "self" as "self" | "family", name: "山田 太郎", relationship: null as string | null, phone: null as string | null, email: null as string | null, notifyMethod: "LINE", receiveNotify: true, isBillingPerson: true, cardRegistered: true },
  { id: "a2", type: "family" as "self" | "family", name: "山田 花子", relationship: "長女", phone: "090-8765-4321", email: "hanako@example.com", notifyMethod: "メール", receiveNotify: true, isBillingPerson: false, cardRegistered: false },
  { id: "a3", type: "family" as "self" | "family", name: "山田 一郎", relationship: "長男", phone: "090-1234-5678", email: "ichiro@example.com", notifyMethod: "郵送", receiveNotify: true, isBillingPerson: false, cardRegistered: false },
];

const statementHistory = [
  { id: "s1", providerName: "田中内科クリニック", serviceDate: "2025-02-10", description: "初診料", amount: 2820, selfPayAmount: 850, paymentStatus: "completed" as const },
  { id: "s2", providerName: "さくら薬局", serviceDate: "2025-02-10", description: "調剤料", amount: 1540, selfPayAmount: 460, paymentStatus: "completed" as const },
  { id: "s3", providerName: "田中内科クリニック", serviceDate: "2025-01-15", description: "再診料", amount: 730, selfPayAmount: 220, paymentStatus: "completed" as const },
  { id: "s4", providerName: "あおぞらタクシー", serviceDate: "2025-01-10", description: "通院送迎", amount: 3200, selfPayAmount: 3200, paymentStatus: "completed" as const },
  { id: "s5", providerName: "田中内科クリニック", serviceDate: "2024-12-20", description: "訪問診療料", amount: 8880, selfPayAmount: 2660, paymentStatus: "failed" as const },
];

const receiptHistory = [
  { id: "rc1", period: "2025年1月", amount: 7530, issuedDate: "2025-02-01" },
  { id: "rc2", period: "2024年12月", amount: 11880, issuedDate: "2025-01-01" },
  { id: "rc3", period: "2024年11月", amount: 5420, issuedDate: "2024-12-01" },
];

type TabType = "basic" | "accounts" | "statements" | "receipts";

export default function ResidentDetailPage() {
  const [activeTab, setActiveTab] = useState<TabType>("basic");

  const tabs: { key: TabType; label: string }[] = [
    { key: "basic", label: "基本情報" },
    { key: "accounts", label: "アカウント" },
    { key: "statements", label: "明細履歴" },
    { key: "receipts", label: "領収書履歴" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/facility/residents">
          <Button variant="ghost" size="sm">
            &larr; 戻る
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {resident.lastName} {resident.firstName}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {resident.lastNameKana} {resident.firstNameKana}
          </p>
        </div>
        <Badge className="bg-green-100 text-green-800 ml-2">入居中</Badge>
      </div>

      {/* タブ */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 基本情報タブ */}
      {activeTab === "basic" && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">基本情報</h3>
              <div className="flex gap-3">
                <Button variant="secondary" size="sm">編集</Button>
                <Button variant="danger" size="sm">退去処理</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-2xl">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">氏名</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{resident.lastName} {resident.firstName}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">フリガナ</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{resident.lastNameKana} {resident.firstNameKana}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">生年月日</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{resident.birthDate}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">性別</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{resident.gender}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">被保険者番号</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{resident.insuranceNumber}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">入居日</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{resident.admissionDate}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">部屋番号</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{resident.roomNumber}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">カード登録状況</p>
                <div className="mt-0.5">
                  {resident.cardRegistered ? (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm font-medium text-gray-900">登録済み</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{resident.cardBrand} •••• {resident.cardLast4}</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-900">未登録</span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1.5">カード登録は入居者ご本人様またはご家族様がご自身の端末から行います</p>
                </div>
              </div>
            </div>
            {resident.notes && (
              <div className="mt-4 max-w-2xl">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">備考</p>
                  <p className="text-sm text-gray-900 mt-0.5">{resident.notes}</p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* アカウントタブ */}
      {activeTab === "accounts" && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">アカウント情報</h3>
              <Button size="sm">アカウントを追加</Button>
            </div>
            <div className="space-y-4">
              {accounts.map((account) => (
                <div key={account.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{account.type === "self" ? "👤" : "👥"}</span>
                      <p className="text-sm font-semibold text-gray-900">{account.name}</p>
                      <Badge className={account.type === "self" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}>
                        {account.type === "self" ? "入居者本人" : "家族"}
                      </Badge>
                      {account.relationship && (
                        <Badge className="bg-gray-100 text-gray-800">{account.relationship}</Badge>
                      )}
                      {account.isBillingPerson && (
                        <Badge className="bg-emerald-100 text-emerald-800">決済担当</Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">編集</Button>
                      {account.type !== "self" && (
                        <Button variant="ghost" size="sm">削除</Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">通知方法</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {account.notifyMethod === "LINE" && <span className="inline-block w-2 h-2 rounded-full bg-[#06C755]" />}
                        <p className="text-sm text-gray-900">{account.notifyMethod}</p>
                      </div>
                    </div>
                    {account.type === "family" && (
                      <>
                        <div>
                          <p className="text-xs text-gray-500">電話番号</p>
                          <p className="text-sm text-gray-900">{account.phone}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">メールアドレス</p>
                          <p className="text-sm text-gray-900">{account.email}</p>
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">カード登録</p>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {account.cardRegistered ? (
                          <span className="text-green-600">登録済み</span>
                        ) : (
                          <span className="text-yellow-600">未登録</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* 明細履歴タブ */}
      {activeTab === "statements" && (
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">明細履歴</h3>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>サービス提供者</TableHeader>
                  <TableHeader>サービス日</TableHeader>
                  <TableHeader>内容</TableHeader>
                  <TableHeader>金額</TableHeader>
                  <TableHeader>自己負担額</TableHeader>
                  <TableHeader>決済ステータス</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {statementHistory.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.providerName}</TableCell>
                    <TableCell>{s.serviceDate}</TableCell>
                    <TableCell>{s.description}</TableCell>
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
      )}

      {/* 領収書履歴タブ */}
      {activeTab === "receipts" && (
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">領収書履歴</h3>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>対象期間</TableHeader>
                  <TableHeader>金額</TableHeader>
                  <TableHeader>発行日</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {receiptHistory.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.period}</TableCell>
                    <TableCell>{formatCurrency(r.amount)}</TableCell>
                    <TableCell>{r.issuedDate}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">PDFをダウンロード</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
