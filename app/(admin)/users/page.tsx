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
import { USER_ROLE_LABELS } from "@/lib/constants";
import type { User } from "@/lib/types";

// ダミーデータ
const dummyUsers: User[] = [
  {
    id: "u1",
    email: "admin@universal.co.jp",
    name: "管理者 太郎",
    role: "admin",
    createdAt: "2024-10-01T10:00:00Z",
    updatedAt: "2024-10-01T10:00:00Z",
  },
  {
    id: "u2",
    email: "tanaka@tanaka-clinic.jp",
    name: "田中 医院長",
    role: "provider",
    providerId: "m1",
    createdAt: "2024-11-01T10:00:00Z",
    updatedAt: "2024-11-01T10:00:00Z",
  },
  {
    id: "u3",
    email: "sakura-admin@sakura-care.jp",
    name: "さくら施設管理者",
    role: "facility",
    facilityId: "fac1",
    createdAt: "2024-11-15T10:00:00Z",
    updatedAt: "2024-11-15T10:00:00Z",
  },
  {
    id: "u4",
    email: "yamada.family@example.jp",
    name: "山田 花子",
    role: "resident_family",
    lineUserId: "U1234567890",
    createdAt: "2024-12-01T10:00:00Z",
    updatedAt: "2024-12-01T10:00:00Z",
  },
  {
    id: "u5",
    email: "suzuki.family@example.jp",
    name: "鈴木 次郎",
    role: "resident_family",
    createdAt: "2025-01-10T10:00:00Z",
    updatedAt: "2025-01-10T10:00:00Z",
  },
];

const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  provider: "bg-blue-100 text-blue-800",
  facility: "bg-green-100 text-green-800",
  resident_family: "bg-orange-100 text-orange-800",
};

export default function UsersPage() {
  return (
    <div>
      <Header
        title="ユーザー管理"
        description="運営者・サービス提供者・施設・入居者家族の管理"
        actions={<Button>ユーザー追加</Button>}
      />

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>名前</TableHeader>
              <TableHeader>メールアドレス</TableHeader>
              <TableHeader>役割</TableHeader>
              <TableHeader>LINE連携</TableHeader>
              <TableHeader>登録日</TableHeader>
              <TableHeader>操作</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {dummyUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge className={roleColors[user.role]}>
                    {USER_ROLE_LABELS[user.role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.lineUserId ? (
                    <Badge className="bg-green-100 text-green-800">連携済み</Badge>
                  ) : (
                    <span className="text-sm text-gray-400">未連携</span>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString("ja-JP")}
                </TableCell>
                <TableCell>
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    編集
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
