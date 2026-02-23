"use client";

import { useState } from "react";
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

// --- ダミーデータ ---

const staffList = [
  { id: "st1", name: "佐藤 管理者", email: "sato@sakura-care.jp", role: "admin" as const, lastLogin: "2025-02-10 09:30", status: "active" as const },
  { id: "st2", name: "田中 花子", email: "tanaka@sakura-care.jp", role: "staff" as const, lastLogin: "2025-02-10 08:15", status: "active" as const },
  { id: "st3", name: "鈴木 一郎", email: "suzuki@sakura-care.jp", role: "staff" as const, lastLogin: "2025-02-09 14:20", status: "active" as const },
  { id: "st4", name: "高橋 美紀", email: "takahashi@sakura-care.jp", role: "staff" as const, lastLogin: "2025-01-28 10:00", status: "inactive" as const },
];

const STAFF_ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  staff: "スタッフ",
};

const STAFF_ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  staff: "bg-blue-100 text-blue-800",
};

export default function StaffPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("staff");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">スタッフ管理</h2>
          <p className="mt-1 text-sm text-gray-500">施設内のスタッフアカウント管理</p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>スタッフを追加</Button>
      </div>

      {/* 追加フォーム */}
      {showAddForm && (
        <Card className="mb-6">
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">スタッフ追加</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">氏名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="山田 太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="yamada@sakura-care.jp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">権限 <span className="text-red-500">*</span></label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="admin">管理者</option>
                  <option value="staff">スタッフ</option>
                </select>
              </div>
              <p className="text-xs text-gray-500">登録後、招待メールが送信されます。</p>
              <div className="flex gap-3">
                <Button>追加する</Button>
                <Button variant="secondary" onClick={() => setShowAddForm(false)}>キャンセル</Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* スタッフ一覧 */}
      <Card>
        <CardBody>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>氏名</TableHeader>
                <TableHeader>メールアドレス</TableHeader>
                <TableHeader>権限</TableHeader>
                <TableHeader>最終ログイン</TableHeader>
                <TableHeader>ステータス</TableHeader>
                <TableHeader>操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {staffList.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">{staff.name}</TableCell>
                  <TableCell>{staff.email}</TableCell>
                  <TableCell>
                    <Badge className={STAFF_ROLE_COLORS[staff.role]}>
                      {STAFF_ROLE_LABELS[staff.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>{staff.lastLogin}</TableCell>
                  <TableCell>
                    {staff.status === "active" ? (
                      <Badge className="bg-green-100 text-green-800">有効</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800">無効</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">編集</Button>
                      {staff.status === "active" ? (
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
