"use client";

/**
 * 案件詳細の作業ページ（業務ファースト構成）
 *
 * 加盟店申請: メインカラム＝業務カードのみ（申請内容→採番→UD追記・申請書→審査・変換→USEN）。
 *   対応の記録（担当・メモ・履歴）は業務ではなく管理なので、ヘッダーのボタンから
 *   開く右パネルに分離する。進捗チェックリストはグレーの別枠（merchant-work-sections）。
 * 相談・問い合わせ: 対応の記録そのものが業務なので、記載内容→対応の記録を縦に並べる。
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { DrawerContentTab, DrawerManageTab } from "./detail-drawer-tabs";
import { MerchantWorkSections } from "./merchant-work-sections";
import { MerchantStageStepper } from "./merchant-stage-stepper";
import {
  fetchApplicationDetail,
  patchApplication,
  fetchAssignees,
} from "@/lib/applications/client";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import { APPLY_TYPE_COPY } from "@/lib/applications/apply-type";
import type { ApplicationDetail, AssigneeOption, ApplicationPatch } from "@/lib/applications/types";

export interface ApplicationDetailPageProps {
  applicationId: string;
  /** 戻り先の一覧（例: { href: "/admin/inquiries", label: "相談・問い合わせ" }） */
  listHref: string;
  listLabel: string;
}

/** セクション枠（相談・問い合わせ用の縦流れ） */
function WorkSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section
      className="border rounded-lg p-5 mb-4"
      style={{ borderColor: "var(--qolc-border)", backgroundColor: "white" }}
    >
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--qolc-text)" }}>
        {title}
      </h2>
      {hint && (
        <p className="text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
          {hint}
        </p>
      )}
      {children}
    </section>
  );
}

export function ApplicationDetailPage({ applicationId, listHref, listLabel }: ApplicationDetailPageProps) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showManage, setShowManage] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, asg] = await Promise.all([
        fetchApplicationDetail(applicationId),
        fetchAssignees(),
      ]);
      setDetail(d);
      setAssignees(asg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "取得に失敗しました";
      if (msg.includes("404") || msg.includes("見つかりません")) setNotFound(true);
      else setError(msg);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(
    async (patch: ApplicationPatch) => {
      setSaving(true);
      setError(null);
      try {
        await patchApplication(applicationId, patch);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新に失敗しました");
      } finally {
        setSaving(false);
      }
    },
    [applicationId, load]
  );

  /**
   * メモ・工程・審査などの保存後の再読込。
   * 業務ファースト: 「新規」のまま何か作業が記録されたら、状態を対応中へ自動で進める。
   */
  const handleRefresh = useCallback(() => {
    void (async () => {
      if (detail?.status === "new") {
        try {
          await patchApplication(applicationId, { status: "in_progress" });
        } catch {
          // 自動前進の失敗は作業自体を妨げない（次の保存時に再試行される）
        }
      }
      await load();
    })();
  }, [applicationId, detail?.status, load]);

  const isMerchant = detail?.source === "qolc_merchant";
  const title = detail
    ? (detail.applicantOrg ?? detail.applicantName ?? "（申請者不明）")
    : "案件詳細";

  return (
    <PortalLayout portal="admin">
      <Breadcrumb
        items={[
          { label: "今日のUD", href: "/admin/today" },
          { label: listLabel, href: listHref },
          { label: title },
        ]}
      />
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            href={listHref}
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--qolc-primary)" }}
          >
            ← {listLabel}の一覧へ戻る
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-2">
            {title}
            {detail && (
              <span className="ml-3 text-base font-normal" style={{ color: "var(--qolc-muted)" }}>
                {SOURCE_LABELS[detail.source]}
              </span>
            )}
            {isMerchant && detail && (
              <span
                className="ml-2 align-middle text-sm px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                style={{
                  backgroundColor: APPLY_TYPE_COPY[detail.applyType].badgeColor.bg,
                  color: APPLY_TYPE_COPY[detail.applyType].badgeColor.fg,
                }}
              >
                {APPLY_TYPE_COPY[detail.applyType].badge}
              </span>
            )}
          </h1>
        </div>
        {isMerchant && detail && (
          <button
            type="button"
            className="inline-flex items-center justify-center rounded font-medium text-sm px-4 border hover:bg-gray-50"
            style={{ borderColor: "var(--qolc-border)", color: "var(--qolc-text)", minHeight: 44 }}
            onClick={() => setShowManage(true)}
          >
            対応の記録・履歴
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm my-3" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      {notFound ? (
        <EmptyState
          title="案件が見つかりません"
          description="削除されたか、URLが正しくない可能性があります。一覧から選び直してください。"
        />
      ) : !detail ? (
        <LoadingSpinner />
      ) : isMerchant ? (
        <div className="max-w-3xl">
          <MerchantStageStepper row={detail} />
          <MerchantWorkSections
            detail={detail}
            saving={saving}
            onSave={(p) => void handleSave(p)}
            onRefresh={handleRefresh}
          />
        </div>
      ) : (
        <div className="max-w-3xl">
          <WorkSection
            title="① 記載内容"
            hint="お客様が入力した内容です。まずここを読んでから対応してください。"
          >
            <DrawerContentTab detail={detail} />
          </WorkSection>
          <WorkSection
            title="② 対応の記録"
            hint="連絡・対応したらメモを記録してください。新規の案件はメモを記録した時点で「対応中」に自動で進みます。"
          >
            <DrawerManageTab
              detail={detail}
              assignees={assignees}
              saving={saving}
              onSave={(p) => void handleSave(p)}
              onRefresh={handleRefresh}
            />
          </WorkSection>
        </div>
      )}

      {/* 対応の記録・履歴パネル（加盟店申請のみ。業務カラムと分離した管理領域） */}
      {isMerchant && detail && showManage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowManage(false)}
        >
          <div
            className="bg-white h-full w-full max-w-xl overflow-y-auto p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--qolc-text)" }}>
                対応の記録・履歴
              </h2>
              <button
                className="text-sm underline"
                onClick={() => setShowManage(false)}
                style={{ minHeight: 44 }}
              >
                閉じる
              </button>
            </div>
            <DrawerManageTab
              detail={detail}
              assignees={assignees}
              saving={saving}
              onSave={(p) => void handleSave(p)}
              onRefresh={handleRefresh}
            />
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
