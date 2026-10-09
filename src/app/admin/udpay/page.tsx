import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { UdpayCustomerList } from "@/components/udpay-admin/customer-list";

/**
 * UD Payment（請求・カード決済）— 加盟店（ランサイド様など）の顧客とカード登録の管理（UD管理者）。
 */
export default function AdminUdpayPage() {
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "UD Payment" }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">UD Payment — 顧客とカード登録</h1>
        <p className="mt-2" style={{ color: "var(--qolc-muted)" }}>
          加盟店の顧客を登録し、カード登録リンクをお送りします。顧客がリンクからカードを登録すると、会員IDと有効期限がここに表示されます。
        </p>
      </div>
      <UdpayCustomerList />
    </PortalLayout>
  );
}
