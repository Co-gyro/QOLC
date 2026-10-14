import { CustomerEditView } from "../../../udpay/_views/customer-edit-view";

export const dynamic = "force-dynamic";

/** UD Payment（本番）— 画面の中身は共通ビュー（src/app/udpay/_views）で、モードだけを渡す */
export default function Page(props: { params: { id: string } }) {
  return <CustomerEditView params={props.params} mode="billing" />;
}
