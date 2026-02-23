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
import type { Facility } from "@/lib/types";

// ダミーデータ
const dummyFacilities: (Facility & { residentCount: number; merchantCount: number; adminCount: number })[] = [
  {
    id: "fac1",
    name: "さくら介護施設",
    address: "東京都世田谷区桜1-2-3",
    phone: "03-1234-5678",
    email: "info@sakura-care.jp",
    receiptSettings: { issueDay: 0, autoIssue: true },
    residentCount: 45,
    merchantCount: 3,
    adminCount: 2,
    createdAt: "2024-10-01T00:00:00Z",
    updatedAt: "2024-10-01T00:00:00Z",
  },
  {
    id: "fac2",
    name: "あおぞらケアホーム",
    address: "大阪府大阪市北区梅田1-1-1",
    phone: "06-9876-5432",
    email: "info@aozora-care.jp",
    receiptSettings: { issueDay: 25, autoIssue: true },
    residentCount: 32,
    merchantCount: 2,
    adminCount: 1,
    createdAt: "2024-11-15T00:00:00Z",
    updatedAt: "2024-11-15T00:00:00Z",
  },
  {
    id: "fac3",
    name: "ひまわり老人ホーム",
    address: "愛知県名古屋市中区栄3-3-3",
    phone: "052-333-4444",
    email: "info@himawari-home.jp",
    receiptSettings: { issueDay: 0, autoIssue: false },
    residentCount: 28,
    merchantCount: 1,
    adminCount: 3,
    createdAt: "2025-01-10T00:00:00Z",
    updatedAt: "2025-01-10T00:00:00Z",
  },
];

function formatIssueDay(day: number): string {
  return day === 0 ? "月末" : `毎月${day}日`;
}

export default function FacilitiesPage() {
  return (
    <div>
      <Header
        title="施設管理"
        description="介護施設の登録・管理"
        actions={
          <Link href="/facilities/new">
            <Button>施設を登録</Button>
          </Link>
        }
      />

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>施設名</TableHeader>
              <TableHeader>住所</TableHeader>
              <TableHeader>入居者数</TableHeader>
              <TableHeader>加盟店数</TableHeader>
              <TableHeader>管理者数</TableHeader>
              <TableHeader>領収書発行</TableHeader>
              <TableHeader>操作</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {dummyFacilities.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">
                  <Link href={`/facilities/${f.id}`} className="text-blue-600 hover:text-blue-800">
                    {f.name}
                  </Link>
                </TableCell>
                <TableCell>{f.address}</TableCell>
                <TableCell>{f.residentCount}名</TableCell>
                <TableCell>{f.merchantCount}社</TableCell>
                <TableCell>{f.adminCount}名</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatIssueDay(f.receiptSettings.issueDay)}</span>
                    <Badge
                      className={
                        f.receiptSettings.autoIssue
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {f.receiptSettings.autoIssue ? "自動" : "手動"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Link href={`/facilities/${f.id}`} className="text-blue-600 hover:text-blue-800 text-sm">
                    詳細
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
