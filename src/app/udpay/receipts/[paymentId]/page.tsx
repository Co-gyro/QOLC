import { ReceiptView } from "../../_views/receipt-view";

export const dynamic = "force-dynamic";

/** UD Payment（デモ）— 画面の中身は共通ビュー（src/app/udpay/_views）で、モードだけを渡す */
export default function Page(props: { params: { paymentId: string } }) {
  return <ReceiptView params={props.params} mode="demo" />;
}
