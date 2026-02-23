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
  MERCHANT_STATUS_LABELS,
  MERCHANT_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
} from "@/lib/constants";
import type { Merchant } from "@/lib/types";

// ダミーデータ
const dummyMerchants: Merchant[] = [
  {
    id: "m1",
    name: "田中内科クリニック",
    nameKana: "タナカナイカクリニック",
    representativeName: "田中 太郎",
    address: "東京都世田谷区松原4-5-6",
    phone: "03-2345-6789",
    email: "info@tanaka-clinic.jp",
    businessNumber: "1311234567",
    serviceType: "medical",
    bankInfo: {
      bankName: "三菱UFJ銀行",
      branchName: "世田谷支店",
      accountType: "ordinary",
      accountNumber: "2345678",
      accountHolder: "タナカナイカクリニック",
    },
    contractStartDate: "2024-11-01",
    feeRate: 3.5,
    selfishMerchantId: "SEL-001",
    status: "active",
    facilityIds: ["fac1", "fac2"],
    createdAt: "2024-11-01T00:00:00Z",
    updatedAt: "2024-11-01T00:00:00Z",
  },
  {
    id: "m2",
    name: "さくら訪問看護ステーション",
    nameKana: "サクラホウモンカンゴステーション",
    representativeName: "佐藤 花子",
    address: "東京都目黒区中目黒7-8-9",
    phone: "03-3456-7890",
    email: "info@sakura-nursing.jp",
    businessNumber: "1311234568",
    serviceType: "nursing",
    bankInfo: {
      bankName: "りそな銀行",
      branchName: "目黒支店",
      accountType: "ordinary",
      accountNumber: "3456789",
      accountHolder: "サクラホウモンカンゴ",
    },
    contractStartDate: "2024-12-01",
    feeRate: 3.0,
    selfishMerchantId: "SEL-002",
    status: "active",
    facilityIds: ["fac1"],
    createdAt: "2024-12-01T00:00:00Z",
    updatedAt: "2024-12-01T00:00:00Z",
  },
  {
    id: "m3",
    name: "関西リハビリサービス",
    nameKana: "カンサイリハビリサービス",
    representativeName: "木村 四郎",
    address: "大阪府大阪市北区曽根崎2-3-4",
    phone: "06-1111-2222",
    email: "info@kansai-rehab.jp",
    businessNumber: "2711234569",
    serviceType: "care",
    bankInfo: {
      bankName: "三井住友銀行",
      branchName: "曽根崎支店",
      accountType: "ordinary",
      accountNumber: "5678901",
      accountHolder: "カンサイリハビリサービス",
    },
    contractStartDate: "2025-01-15",
    feeRate: 3.5,
    status: "pending",
    facilityIds: ["fac2"],
    createdAt: "2025-01-15T00:00:00Z",
    updatedAt: "2025-01-15T00:00:00Z",
  },
  {
    id: "m4",
    name: "東京介護タクシー",
    nameKana: "トウキョウカイゴタクシー",
    representativeName: "高橋 次郎",
    address: "東京都新宿区西新宿1-1-1",
    phone: "03-5555-6666",
    email: "info@tokyo-care-taxi.jp",
    businessNumber: "1311234570",
    serviceType: "taxi",
    bankInfo: {
      bankName: "みずほ銀行",
      branchName: "新宿支店",
      accountType: "ordinary",
      accountNumber: "6789012",
      accountHolder: "トウキョウカイゴタクシー",
    },
    contractStartDate: "2025-02-01",
    feeRate: 4.0,
    status: "active",
    facilityIds: ["fac1", "fac3"],
    createdAt: "2025-02-01T00:00:00Z",
    updatedAt: "2025-02-01T00:00:00Z",
  },
];

// ダミー施設名マップ
const facilityNames: Record<string, string> = {
  fac1: "さくら介護施設",
  fac2: "あおぞらケアホーム",
  fac3: "ひまわり老人ホーム",
};

export default function MerchantsPage() {
  return (
    <div>
      <Header
        title="加盟店管理"
        description="サービス提供者（加盟店）の登録・管理 → セルフィッシュ連携"
        actions={
          <Link href="/merchants/new">
            <Button>加盟店を登録</Button>
          </Link>
        }
      />

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>加盟店名</TableHeader>
              <TableHeader>サービス種別</TableHeader>
              <TableHeader>対象施設</TableHeader>
              <TableHeader>手数料率</TableHeader>
              <TableHeader>セルフィッシュ</TableHeader>
              <TableHeader>ステータス</TableHeader>
              <TableHeader>操作</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {dummyMerchants.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.representativeName}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-blue-50 text-blue-700">
                    {SERVICE_TYPE_LABELS[m.serviceType]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {m.facilityIds.map((fid) => (
                      <span key={fid} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {facilityNames[fid] || fid}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{m.feeRate}%</TableCell>
                <TableCell>
                  {m.selfishMerchantId ? (
                    <Badge className="bg-green-50 text-green-700">{m.selfishMerchantId}</Badge>
                  ) : (
                    <span className="text-xs text-gray-400">未連携</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={MERCHANT_STATUS_COLORS[m.status]}>
                    {MERCHANT_STATUS_LABELS[m.status]}
                  </Badge>
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
