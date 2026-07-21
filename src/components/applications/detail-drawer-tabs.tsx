"use client";

/**
 * 申請詳細ドロワーの各タブパネル。
 * - 申請内容: お客様が入力した情報の閲覧（読み取り中心）
 * - 進行管理: UD側の対応状況の管理（状態・担当・メモ・履歴）
 * - 登録手続き: 加盟店登録の実務入力（工程・UD追記・審査・変換）
 */
import { EventTimeline } from "./event-timeline";
import { PayloadView } from "./payload-view";
import { EditForm } from "./detail-edit-form";
import { ApplicantInfo } from "./applicant-info";
import { CommentForm } from "./comment-form";
import { WorkflowSection } from "./workflow-section";
import { AssignCodesSection } from "./assign-codes-section";
import { UsenCsvSection } from "./usen-csv-section";
import { UdInputForm } from "./ud-input-form";
import { ReviewSection } from "./review-section";
import { FlowStepper } from "@/components/workflow/flow-stepper";
import { buildStatusFlow } from "@/lib/applications/status-flow";
import { STATUS_LABELS } from "@/lib/applications/labels";
import type { ApplicationDetail, AssigneeOption, ApplicationPatch } from "@/lib/applications/types";

/** セクション見出し + 本文の枠 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-bold mb-2" style={{ color: "var(--qolc-primary)" }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** タブ「申請内容」: 対応フロー現在地・申請者・フォーム入力内容 */
export function DrawerContentTab({ detail }: { detail: ApplicationDetail }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="対応フロー">
        {detail.status === "rejected" ? (
          <span
            className="inline-block text-sm px-3 py-1 rounded-full font-bold"
            style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}
          >
            {STATUS_LABELS.rejected}
          </span>
        ) : (
          <FlowStepper steps={buildStatusFlow(detail.status)} finished={detail.status === "done"} />
        )}
      </Section>

      <Section title="申請者">
        <ApplicantInfo detail={detail} />
      </Section>

      <Section title="フォーム入力内容（お客様の入力がそのまま保存されています）">
        <PayloadView payload={detail.payload} />
      </Section>
    </div>
  );
}

export interface DrawerManageTabProps {
  detail: ApplicationDetail;
  assignees: AssigneeOption[];
  saving: boolean;
  onSave: (patch: ApplicationPatch) => void;
  onRefresh: () => void;
}

/** タブ「進行管理」: 状態/担当/優先度/期限/次アクション・対応メモ・変更履歴 */
export function DrawerManageTab({
  detail,
  assignees,
  saving,
  onSave,
  onRefresh,
}: DrawerManageTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="対応状況の管理">
        <EditForm detail={detail} assignees={assignees} saving={saving} onSave={onSave} />
      </Section>

      <Section title="対応メモ">
        <CommentForm applicationId={detail.id} onSaved={onRefresh} />
      </Section>

      <Section title="変更履歴">
        <EventTimeline events={detail.events} />
      </Section>
    </div>
  );
}

export interface DrawerProcedureTabProps {
  detail: ApplicationDetail;
  saving: boolean;
  onSave: (patch: ApplicationPatch) => void;
  onRefresh: () => void;
}

/** タブ「登録手続き」（加盟店申請のみ）: 工程・UD追記・申請書・審査結果・変換 */
export function DrawerProcedureTab({
  detail,
  saving,
  onSave,
  onRefresh,
}: DrawerProcedureTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        加盟店登録までの実務をここで進めます: ①工程チェックリストの起票 → ②採番 →
        ③UD追記情報の入力・申請書の作成 → ④カード会社へ提出 → ⑤審査結果の登録 →
        ⑥加盟店として登録（施設登録・USEN／セルフィッシュへの入力は工程チェックリストで管理）。
      </p>

      <Section title="① 申請工程（チェックリスト）">
        <WorkflowSection detail={detail} onStarted={onRefresh} />
      </Section>

      <Section title="② 採番（モールコード・端末識別番号）">
        <AssignCodesSection detail={detail} onAssigned={onRefresh} />
      </Section>

      <Section title="③ UD追記情報・申請書作成">
        <UdInputForm
          udInput={detail.udInput}
          saving={saving}
          onSave={(ud) => onSave({ ud_input: ud })}
        />
        <a
          href={`/admin/merchant-application?applicationId=${detail.id}`}
          className="mt-2 inline-flex items-center text-sm underline font-medium"
          style={{ color: "var(--qolc-primary)", minHeight: 44 }}
        >
          申請書を作成（この申請の内容を反映して開く）
        </a>
      </Section>

      <Section title="④⑤⑥ 審査結果の登録・加盟店へ変換">
        <ReviewSection detail={detail} onSaved={onRefresh} />
      </Section>

      <Section title="⑦ USEN連携用CSV（審査通過後）">
        <UsenCsvSection detail={detail} />
      </Section>
    </div>
  );
}
