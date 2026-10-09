import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { UdpayCustomerForm } from "@/components/udpay-admin/customer-form";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/applications/server";
import { getCustomer } from "@/lib/udpay/prod/customers";
import { getUdpayMerchant } from "@/lib/udpay/prod/merchants";

export const dynamic = "force-dynamic";

/** UD Payment 顧客の編集（UD管理者。ページ表示は middleware の admin ロール判定で保護） */
export default async function AdminUdpayEditCustomerPage({ params }: { params: { id: string } }) {
  const client = getSupabaseAdminClient();
  const customer = isUuid(params.id) ? await getCustomer(client, params.id) : null;
  const merchant = customer ? await getUdpayMerchant(client, customer.merchantId) : null;
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "UD Payment", href: "/admin/udpay" }, { label: "顧客の編集" }]} />
      <h1 className="mb-4 text-2xl font-bold tracking-tight">顧客の編集</h1>
      {customer && merchant ? (
        <UdpayCustomerForm merchantId={merchant.id} merchantName={merchant.name} chargeDays={merchant.chargeDays} initial={customer} />
      ) : (
        <p>顧客が見つかりません。</p>
      )}
    </PortalLayout>
  );
}
