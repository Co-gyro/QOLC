import { DashboardView } from "../udpay/_views/dashboard-view";

export const dynamic = "force-dynamic";

/** UD Payment（本番）— 画面の中身は共通ビュー（src/app/udpay/_views）で、モードだけを渡す */
export default function Page() {
  return <DashboardView mode="billing" />;
}
