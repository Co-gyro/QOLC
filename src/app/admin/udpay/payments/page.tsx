import Link from "next/link";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { UdpayPaymentList } from "@/components/udpay-admin/payment-list";

/**
 * UD Payment — 決済の一覧と取消・返品（UD管理者）。
 * 加盟店からの取消・返金の依頼を受けて、UD が全額の取消・返品を行う。
 */
export default function AdminUdpayPaymentsPage() {
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "UD Payment", href: "/admin/udpay" }, { label: "決済（取消・返品）" }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">UD Payment — 決済と取消・返品</h1>
        <p className="mt-2" style={{ color: "var(--qolc-muted)" }}>
          入金済みの決済は、課金当日なら「取消」（利用明細に載らない）、翌日以降は「返品」（明細に請求と返金が載る）で全額を戻せます。
          一部だけの返金は、翌月の請求でマイナス明細を入れて相殺してください。
          <Link href="/admin/udpay" className="ml-2 text-[#3D7A55] underline">顧客とカード登録へ</Link>
        </p>
      </div>
      <UdpayPaymentList />
    </PortalLayout>
  );
}
