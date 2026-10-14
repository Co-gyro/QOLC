import { PaymentsView } from "../../udpay/_views/payments-view";

export const dynamic = "force-dynamic";

/** UD Payment（本番）— 画面の中身は共通ビュー（src/app/udpay/_views）で、モードだけを渡す */
export default function Page(props: { searchParams: { month?: string; status?: string; q?: string; done?: string } }) {
  return <PaymentsView searchParams={props.searchParams} mode="billing" />;
}
