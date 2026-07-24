"use client";

/**
 * 案件詳細のパネル部品（相談・問い合わせの縦流れ／加盟店の対応記録パネルで使用）。
 * - 申請内容: お客様が入力した情報の閲覧（読み取り中心）
 * - 進行管理: UD側の対応状況の管理（状態・担当・メモ・履歴）
 * 加盟店申請の実務入力は merchant-work-sections.tsx（業務カード群）が担う。
 */
import { EventTimeline } from "./event-timeline";
import { PayloadView } from "./payload-view";
import { EditForm } from "./detail-edit-form";
import { ApplicantInfo } from "./applicant-info";
import { CommentForm } from "./comment-form";
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

// 旧「登録手続き」タブ（DrawerProcedureTab）は業務ファースト再編（2026-07-24）で
// merchant-work-sections.tsx の業務カード群に置き換えられ廃止された。
