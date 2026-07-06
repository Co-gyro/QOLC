/**
 * 申請詳細ドロワー
 *
 * 申請内容(payload) + 変更履歴タイムライン + 操作フォーム（状態/担当者/優先度/期限/
 * 次アクション）+ 対応メモに加え、加盟店申請（qolc_merchant）では
 * 申請工程チェックリスト・UD追記情報・審査結果・加盟店変換までを一気通貫で扱う。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EventTimeline } from "./event-timeline";
import { PayloadView } from "./payload-view";
import { EditForm } from "./detail-edit-form";
import { ApplicantInfo } from "./applicant-info";
import { CommentForm } from "./comment-form";
import { WorkflowSection } from "./workflow-section";
import { UdInputForm } from "./ud-input-form";
import { ReviewSection } from "./review-section";
import {
  fetchApplicationDetail,
  patchApplication,
} from "@/lib/applications/client";
import { SOURCE_LABELS, STATUS_LABELS } from "@/lib/applications/labels";
import { buildStatusFlow } from "@/lib/applications/status-flow";
import { FlowStepper } from "@/components/workflow/flow-stepper";
import type { ApplicationDetail, AssigneeOption, ApplicationPatch } from "@/lib/applications/types";

export interface DetailDrawerProps {
  applicationId: string | null;
  assignees: AssigneeOption[];
  onClose: () => void;
  /** 保存後に一覧を再取得させるためのコールバック */
  onSaved: () => void;
}

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

export function DetailDrawer({ applicationId, assignees, onClose, onSaved }: DetailDrawerProps) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (id: string) => {
    setError(null);
    try {
      setDetail(await fetchApplicationDetail(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    if (applicationId) void load(applicationId);
  }, [applicationId, load]);

  useEffect(() => {
    if (!applicationId) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [applicationId, onClose]);

  const handleSave = useCallback(
    async (patch: ApplicationPatch) => {
      if (!applicationId) return;
      setSaving(true);
      setError(null);
      try {
        await patchApplication(applicationId, patch);
        await load(applicationId);
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新に失敗しました");
      } finally {
        setSaving(false);
      }
    },
    [applicationId, load, onSaved]
  );

  /** 詳細を再読込しつつ一覧も更新する（メモ・工程・審査の保存後） */
  const handleRefresh = useCallback(() => {
    if (applicationId) void load(applicationId);
    onSaved();
  }, [applicationId, load, onSaved]);

  if (!applicationId) return null;
  const isMerchantApply = detail?.source === "qolc_merchant";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="bg-white h-full w-full max-w-xl overflow-y-auto p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: "var(--qolc-text)" }}>
            {detail ? SOURCE_LABELS[detail.source] : "申請詳細"}
          </h2>
          <button className="text-sm underline" onClick={onClose} aria-label="閉じる" style={{ minHeight: 44 }}>
            閉じる
          </button>
        </div>

        {error && (
          <p className="text-sm mb-3" style={{ color: "#DC2626" }}>
            {error}
          </p>
        )}

        {!detail ? (
          <LoadingSpinner />
        ) : (
          <div className="flex flex-col gap-6" key={detail.id}>
            <Section title="対応フロー">
              {detail.status === "rejected" ? (
                <span
                  className="inline-block text-sm px-3 py-1 rounded-full font-bold"
                  style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}
                >
                  {STATUS_LABELS.rejected}
                </span>
              ) : (
                <FlowStepper
                  steps={buildStatusFlow(detail.status)}
                  finished={detail.status === "done"}
                />
              )}
            </Section>

            <Section title="申請者">
              <ApplicantInfo detail={detail} />
            </Section>

            <Section title="対応">
              <EditForm detail={detail} assignees={assignees} saving={saving} onSave={handleSave} />
            </Section>

            <Section title="対応メモ">
              <CommentForm applicationId={detail.id} onSaved={handleRefresh} />
            </Section>

            {isMerchantApply && (
              <>
                <Section title="申請工程">
                  <WorkflowSection detail={detail} onStarted={handleRefresh} />
                </Section>

                <Section title="UD追記情報">
                  <UdInputForm
                    udInput={detail.udInput}
                    saving={saving}
                    onSave={(ud) => handleSave({ ud_input: ud })}
                  />
                  <a
                    href={`/admin/merchant-application?applicationId=${detail.id}`}
                    className="mt-2 inline-flex items-center text-sm underline font-medium"
                    style={{ color: "var(--qolc-primary)", minHeight: 44 }}
                  >
                    申請書を作成（この申請の内容を反映して開く）
                  </a>
                </Section>

                <Section title="審査結果">
                  <ReviewSection detail={detail} onSaved={handleRefresh} />
                </Section>
              </>
            )}

            <Section title="申請内容">
              <PayloadView payload={detail.payload} />
            </Section>

            <Section title="変更履歴">
              <EventTimeline events={detail.events} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
