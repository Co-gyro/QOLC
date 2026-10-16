import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { MerchantKarte } from "@/components/merchant-karte/merchant-karte";

/** 加盟店カルテ（UD管理者）。加盟店一覧の加盟店名から開く */
export default function AdminMerchantKartePage({ params }: { params: { id: string } }) {
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "加盟店", href: "/admin/merchants" }, { label: "加盟店カルテ" }]} />
      <MerchantKarte merchantId={params.id} />
    </PortalLayout>
  );
}
