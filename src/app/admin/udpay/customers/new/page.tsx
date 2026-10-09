import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { UdpayCustomerForm } from "@/components/udpay-admin/customer-form";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUdpayMerchant } from "@/lib/udpay/prod/merchants";

export const dynamic = "force-dynamic";

/** UD Payment 顧客の新規登録（UD管理者。ページ表示は middleware の admin ロール判定で保護） */
export default async function AdminUdpayNewCustomerPage({ searchParams }: { searchParams: { merchantId?: string } }) {
  const merchant = searchParams.merchantId
    ? await getUdpayMerchant(getSupabaseAdminClient(), searchParams.merchantId)
    : null;
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "UD Payment", href: "/admin/udpay" }, { label: "顧客を追加" }]} />
      <h1 className="mb-4 text-2xl font-bold tracking-tight">顧客を追加</h1>
      {merchant ? (
        <UdpayCustomerForm merchantId={merchant.id} merchantName={merchant.name} chargeDays={merchant.chargeDays} />
      ) : (
        <p>加盟店が見つかりません。UD Payment の一覧から操作してください。</p>
      )}
    </PortalLayout>
  );
}
