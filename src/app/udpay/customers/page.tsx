import { CustomersView } from "../_views/customers-view";

export const dynamic = "force-dynamic";

/** UD Payment（デモ）— 画面の中身は共通ビュー（src/app/udpay/_views）で、モードだけを渡す */
export default function Page(props: { searchParams: { q?: string; card?: string } }) {
  return <CustomersView searchParams={props.searchParams} mode="demo" />;
}
