import { ConfirmView } from "../../_views/confirm-view";

export const dynamic = "force-dynamic";

/** UD Payment（デモ）— 画面の中身は共通ビュー（src/app/udpay/_views）で、モードだけを渡す */
export default function Page() {
  return <ConfirmView mode="demo" />;
}
