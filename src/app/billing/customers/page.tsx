import { CustomersView } from "../../udpay/_views/customers-view";

export const dynamic = "force-dynamic";

/** UD Payment（本番）— 画面の中身は共通ビュー（src/app/udpay/_views）で、モードだけを渡す */
export default function Page(props: { searchParams: { q?: string; card?: string } }) {
  return <CustomersView searchParams={props.searchParams} mode="billing" />;
}
