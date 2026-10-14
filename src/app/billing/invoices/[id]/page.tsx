import { InvoiceDetailView } from "../../../udpay/_views/invoice-detail-view";

export const dynamic = "force-dynamic";

/** UD Payment（本番）— 画面の中身は共通ビュー（src/app/udpay/_views）で、モードだけを渡す */
export default function Page(props: { params: { id: string } }) {
  return <InvoiceDetailView params={props.params} mode="billing" />;
}
