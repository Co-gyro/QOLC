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

// --- ダミーデータ ---

type FacilityAdmin = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
  status: "active" | "inactive";
  lastLoginAt: string | null;
  createdAt: string;
};

const dummyFacility = {
  id: "fac1",
  name: "さくら介護施設",
  address: "東京都世田谷区桜1-2-3",
  phone: "03-1234-5678",
  fax: "03-1234-5679",
  email: "info@sakura-care.jp",
  representative: "佐藤 一郎",
  businessNumber: "1310000001",
  residentCount: 45,
  merchantCount: 3,
  receiptSettings: { issueDay: 0, autoIssue: true },
  uploadFormat: { id: "fmt1", name: "〇〇レセプトシステム v2" },
  createdAt: "2024-10-01T00:00:00Z",
};

const dummyAdmins: FacilityAdmin[] = [
  {
    id: "fa1",
    name: "佐藤 一郎",
    email: "sato@sakura-care.jp",
    role: "admin",
    status: "active",
    lastLoginAt: "2025-02-10T08:30:00Z",
    createdAt: "2024-10-01T00:00:00Z",
  },
  {
    id: "fa2",
    name: "田中 美咲",
    email: "tanaka@sakura-care.jp",
    role: "staff",
    status: "active",
    lastLoginAt: "2025-02-09T17:00:00Z",
    createdAt: "2024-12-01T00:00:00Z",
  },
];

const roleLabels: Record<string, string> = {
  admin: "管理者",
  staff: "スタッフ",
};

const roleColors: Record<string, string> = {
  admin: "bg-blue-100 text-blue-800",
  staff: "bg-gray-100 text-gray-800",
};

const statusLabels: Record<string, string> = {
  active: "有効",
  inactive: "無効",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-red-100 text-red-800",
};

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "未ログイン";
  const d = new Date(dateString);
  return d.toLocaleDateString("ja-JP") + " " + d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function formatIssueDay(day: number): string {
  return day === 0 ? "月末" : `毎月${day}日`;
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export default function FacilityDetailPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const facility = dummyFacility;

  return (
    <div>
      <Header
        title={facility.name}
        description="施設情報・管理者アカウントの管理"
        actions={
          <Link href="/facilities">
            <Button variant="secondary">一覧に戻る</Button>
          </Link>
        }
      />

      <div className="space-y-6">
        {/* 施設情報 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">施設情報</h3>
              <button className="text-blue-600 hover:text-blue-800 text-sm">編集</button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className="text-xs text-gray-500">施設名</p>
                <p className="text-sm font-medium mt-0.5">{facility.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">代表者名</p>
                <p className="text-sm font-medium mt-0.5">{facility.representative}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">住所</p>
                <p className="text-sm font-medium mt-0.5">{facility.address}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">事業所番号</p>
                <p className="text-sm font-medium mt-0.5">{facility.businessNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">電話番号</p>
                <p className="text-sm font-medium mt-0.5">{facility.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">FAX</p>
                <p className="text-sm font-medium mt-0.5">{facility.fax}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">メールアドレス</p>
                <p className="text-sm font-medium mt-0.5">{facility.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">領収書発行</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-medium">{formatIssueDay(facility.receiptSettings.issueDay)}</span>
                  <Badge className={facility.receiptSettings.autoIssue ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {facility.receiptSettings.autoIssue ? "自動" : "手動"}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">入居者数</p>
                <p className="text-sm font-medium mt-0.5">{facility.residentCount}名</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">提携加盟店数</p>
                <p className="text-sm font-medium mt-0.5">{facility.merchantCount}社</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">明細CSVフォーマット</p>
                <p className="text-sm font-medium mt-0.5">
                  {facility.uploadFormat ? (
                    <Link href="/master" className="text-blue-600 hover:text-blue-800">
                      {facility.uploadFormat.name}
                    </Link>
                  ) : (
                    <span className="text-gray-400">未設定</span>
                  )}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 管理者アカウント */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">管理者アカウント</h3>
                <p className="text-xs text-gray-500 mt-1">この施設にログインできるアカウントを管理します</p>
              </div>
              <Button onClick={() => setShowAddForm(!showAddForm)}>
                {showAddForm ? "キャンセル" : "アカウントを追加"}
              </Button>
            </div>
          </CardHeader>

          {showAddForm && (
            <CardBody className="border-b border-gray-200 bg-gray-50">
              <form onSubmit={(e) => { e.preventDefault(); setShowAddForm(false); }} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      氏名 <span className="text-red-500">*</span>
                    </label>
                    <input type="text" required className={inputClass} placeholder="山田 花子" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      メールアドレス <span className="text-red-500">*</span>
                    </label>
                    <input type="email" required className={inputClass} placeholder="yamada@sakura-care.jp" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ロール <span className="text-red-500">*</span>
                    </label>
                    <select required className={inputClass}>
                      <option value="admin">管理者（施設設定の変更が可能）</option>
                      <option value="staff">スタッフ（閲覧・明細確認のみ）</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit">追加する</Button>
                </div>
              </form>
            </CardBody>
          )}

          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>氏名</TableHeader>
                <TableHeader>メールアドレス</TableHeader>
                <TableHeader>ロール</TableHeader>
                <TableHeader>最終ログイン</TableHeader>
                <TableHeader>ステータス</TableHeader>
                <TableHeader>操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {dummyAdmins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>
                    <Badge className={roleColors[admin.role]}>
                      {roleLabels[admin.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDateTime(admin.lastLoginAt)}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[admin.status]}>
                      {statusLabels[admin.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-3">
                      <button className="text-blue-600 hover:text-blue-800 text-sm">編集</button>
                      <button className="text-yellow-600 hover:text-yellow-800 text-sm">
                        {admin.status === "active" ? "無効化" : "有効化"}
                      </button>
                      <button className="text-red-600 hover:text-red-800 text-sm">削除</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
