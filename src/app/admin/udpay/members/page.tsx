import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { UdpayMemberList } from "@/components/udpay-admin/member-list";

/** UD Payment — 加盟店の利用者（担当者・承認者）のアカウント管理（UD管理者） */
export default function AdminUdpayMembersPage() {
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "UD Payment", href: "/admin/udpay" }, { label: "利用者（アカウント）" }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">UD Payment — 利用者のアカウント</h1>
        <p className="mt-2" style={{ color: "var(--qolc-muted)" }}>
          加盟店の担当者・承認者のログインアカウントを発行します。招待メールのリンクからパスワードを設定すると、本番画面（/billing）を使えます。
        </p>
      </div>
      <UdpayMemberList />
    </PortalLayout>
  );
}
