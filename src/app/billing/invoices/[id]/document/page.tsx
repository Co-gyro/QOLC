import { InvoiceDocumentView } from "../../../../udpay/_views/invoice-document-view";

export const dynamic = "force-dynamic";

/** UD Payment（本番）— 画面の中身は共通ビュー（src/app/udpay/_views）で、モードだけを渡す */
export default function Page(props: { params: { id: string } }) {
  return <InvoiceDocumentView params={props.params} mode="billing" />;
}
