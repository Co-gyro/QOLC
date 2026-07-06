/**
 * 申請（applications）の対応フローをステッパー表示用に組み立てる純ロジック
 */
import type { FlowStepperStep } from "@/components/workflow/flow-stepper";
import type { ApplicationStatus } from "@/lib/applications/labels";

/**
 * 申請の対応フロー（受付→対応→完了）をステッパー用に組み立てる。
 * - 受付: 申請が存在する時点で常に消化済み
 * - 対応: waiting のときはラベルを「相手待ち」に切り替える
 * - 却下（rejected）は完了ノードに至らないため、呼び出し側でバッジ表示に切り替えること
 * @param status 申請の現在状態
 */
export function buildStatusFlow(status: ApplicationStatus): FlowStepperStep[] {
  return [
    { key: "received", label: "受付", status: "done" },
    {
      key: "handling",
      label: status === "waiting" ? "相手待ち" : "対応中",
      status: status === "done" ? "done" : "todo",
    },
    { key: "done", label: "完了", status: status === "done" ? "done" : "todo" },
  ];
}
