"use client";

import { useState } from "react";
import Link from "next/link";
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
import { SERVICE_TYPE_LABELS } from "@/lib/constants";

// ダミーデータ
const serviceTypeMaster = Object.entries(SERVICE_TYPE_LABELS).map(([key, label], i) => ({
  id: `st-${key}`,
  code: key,
  label,
  sortOrder: i + 1,
  enabled: true,
}));

const feeRateSettings = [
  { id: "fr1", label: "標準手数料率", value: 3.5, description: "新規加盟店のデフォルト手数料率" },
  { id: "fr2", label: "介護施設手数料率", value: 2.5, description: "介護施設（加盟店）の手数料率" },
  { id: "fr3", label: "大口割引手数料率", value: 2.0, description: "月間取引額100万円以上" },
];

const uploadFormats = [
  { id: "fmt1", name: "〇〇レセプトシステム v2", code: "FORMAT_001", fileType: "CSV", encoding: "Shift_JIS", merchantCount: 3, status: "active" as const, createdAt: "2025-01-15" },
  { id: "fmt2", name: "△△レセプトシステム", code: "FORMAT_002", fileType: "CSV", encoding: "UTF-8", merchantCount: 2, status: "active" as const, createdAt: "2025-01-20" },
  { id: "fmt3", name: "タクシー請求書フォーマット", code: "FORMAT_003", fileType: "CSV", encoding: "UTF-8", merchantCount: 1, status: "active" as const, createdAt: "2025-01-25" },
  { id: "fmt4", name: "汎用CSV", code: "FORMAT_004", fileType: "CSV", encoding: "UTF-8", merchantCount: 0, status: "inactive" as const, createdAt: "2025-02-01" },
];

const formatStatusLabels: Record<string, string> = { active: "有効", inactive: "無効" };
const formatStatusColors: Record<string, string> = { active: "bg-green-100 text-green-800", inactive: "bg-gray-100 text-gray-800" };

type Tab = "service_types" | "fee_rates" | "upload_formats";

export default function MasterPage() {
  const [tab, setTab] = useState<Tab>("service_types");

  const tabs: { key: Tab; label: string }[] = [
    { key: "service_types", label: "サービス種別マスタ" },
    { key: "fee_rates", label: "手数料率設定" },
    { key: "upload_formats", label: "アップロードフォーマット管理" },
  ];

  return (
    <div>
      <Header
        title="マスタ管理"
        description="サービス種別・手数料率等のマスタデータを管理します"
      />

      <div className="flex gap-1 mb-6">
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
          </button>
        ))}
      </div>

      {tab === "service_types" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">サービス種別マスタ</h3>
              <Button>種別を追加</Button>
            </div>
          </CardHeader>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>コード</TableHeader>
                <TableHeader>表示名</TableHeader>
                <TableHeader>表示順</TableHeader>
                <TableHeader>状態</TableHeader>
                <TableHeader>操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {serviceTypeMaster.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell>{item.sortOrder}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                      有効
                    </span>
                  </TableCell>
                  <TableCell>
                    <button className="text-blue-600 hover:text-blue-800 text-sm">編集</button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {tab === "fee_rates" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">手数料率設定</h3>
              <Button>設定を追加</Button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {feeRateSettings.map((setting) => (
                <div key={setting.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{setting.label}</p>
                    <p className="text-sm text-gray-500">{setting.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-gray-900">{setting.value}%</span>
                    <button className="text-blue-600 hover:text-blue-800 text-sm">編集</button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {tab === "upload_formats" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">アップロードフォーマット管理</h3>
              <Link href="/master/formats/new">
                <Button>フォーマットを追加</Button>
              </Link>
            </div>
          </CardHeader>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>フォーマット名</TableHeader>
                <TableHeader>コード</TableHeader>
                <TableHeader>ファイル形式</TableHeader>
                <TableHeader>文字コード</TableHeader>
                <TableHeader>使用加盟店数</TableHeader>
                <TableHeader>ステータス</TableHeader>
                <TableHeader>操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploadFormats.map((fmt) => (
                <TableRow key={fmt.id}>
                  <TableCell className="font-medium">{fmt.name}</TableCell>
                  <TableCell className="font-mono text-sm">{fmt.code}</TableCell>
                  <TableCell>{fmt.fileType}</TableCell>
                  <TableCell>{fmt.encoding}</TableCell>
                  <TableCell>{fmt.merchantCount}店</TableCell>
                  <TableCell>
                    <Badge className={formatStatusColors[fmt.status]}>
                      {formatStatusLabels[fmt.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button className="text-blue-600 hover:text-blue-800 text-sm">編集</button>
                      <button className="text-gray-600 hover:text-gray-800 text-sm">複製</button>
                      <button className="text-red-600 hover:text-red-800 text-sm">削除</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
