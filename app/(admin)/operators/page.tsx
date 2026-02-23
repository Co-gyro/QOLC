import Link from "next/link";
import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Table, {
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/Table";
import {
  OPERATOR_ROLE_LABELS,
  OPERATOR_ROLE_COLORS,
  OPERATOR_STATUS_LABELS,
  OPERATOR_STATUS_COLORS,
} from "@/lib/constants";

// ダミーデータ
type Operator = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
};

const dummyOperators: Operator[] = [
  {
    id: "op1",
    name: "管理者 太郎",
    email: "admin@universal.co.jp",
    role: "super_admin",
    status: "active",
    lastLoginAt: "2025-02-10T08:30:00Z",
    createdAt: "2024-10-01T10:00:00Z",
  },
  {
    id: "op2",
    name: "運営 花子",
    email: "hanako@universal.co.jp",
    role: "admin",
    status: "active",
    lastLoginAt: "2025-02-09T17:45:00Z",
    createdAt: "2024-11-01T10:00:00Z",
  },
  {
    id: "op3",
    name: "閲覧 次郎",
    email: "jiro@universal.co.jp",
    role: "viewer",
    status: "active",
    lastLoginAt: "2025-02-07T12:00:00Z",
    createdAt: "2025-01-15T10:00:00Z",
  },
  {
    id: "op4",
    name: "退職 三郎",
    email: "saburo@universal.co.jp",
    role: "admin",
    status: "inactive",
    lastLoginAt: "2024-12-20T09:00:00Z",
    createdAt: "2024-10-15T10:00:00Z",
  },
];

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "未ログイン";
  const d = new Date(dateString);
  return d.toLocaleDateString("ja-JP") + " " + d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export default function OperatorsPage() {
  return (
    <div>
      <Header
        title="運営者管理"
        description="ユニバーサルの運営者アカウントを管理します"
        actions={
          <Link href="/operators/new">
            <Button>運営者を追加</Button>
          </Link>
        }
      />

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>名前</TableHeader>
              <TableHeader>メールアドレス</TableHeader>
              <TableHeader>ロール</TableHeader>
              <TableHeader>最終ログイン</TableHeader>
              <TableHeader>ステータス</TableHeader>
              <TableHeader>操作</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {dummyOperators.map((op) => (
              <TableRow key={op.id}>
                <TableCell className="font-medium">{op.name}</TableCell>
                <TableCell>{op.email}</TableCell>
                <TableCell>
                  <Badge className={OPERATOR_ROLE_COLORS[op.role]}>
                    {OPERATOR_ROLE_LABELS[op.role]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {formatDateTime(op.lastLoginAt)}
                </TableCell>
                <TableCell>
                  <Badge className={OPERATOR_STATUS_COLORS[op.status]}>
                    {OPERATOR_STATUS_LABELS[op.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      編集
                    </button>
                    <button className="text-red-600 hover:text-red-800 text-sm">
                      削除
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
