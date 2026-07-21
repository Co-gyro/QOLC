"use client";

/**
 * 案件詳細の作業ページ（業務ファースト構成・縦流れ第一版）
 *
 * ドロワー（右半分ポップアップ）をやめ、専用ページで上から順に作業する:
 * ① 記載内容（お客様の入力をまず読む）
 * ② 登録手続き（加盟店申請のみ: 採番・UD追記・申請書・審査・変換）
 * ③ 対応の記録（担当・メモ・履歴。メモを記録すると新規→対応中へ自動で進む）
 * 中身は実績のある detail-drawer-tabs のパネルを再利用する。
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { DrawerContentTab, DrawerManageTab, DrawerProcedureTab } from "./detail-drawer-tabs";
import {
  fetchApplicationDetail,
  patchApplication,
  fetchAssignees,
} from "@/lib/applications/client";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import type { ApplicationDetail, AssigneeOption, ApplicationPatch } from "@/lib/applications/types";

export interface ApplicationDetailPageProps {
  applicationId: string;
  /** 戻り先の一覧（例: { href: "/admin/inquiries", label: "相談・問い合わせ" }） */
  listHref: string;
  listLabel: string;
}

/** セクション枠（縦流れの1工程） */
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
   * 業務ファースト: 「新規」のまま何か作業が記録されたら、状態を対応中へ自動で進める
   * （手動でステータスを更新させない）。
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
      <div className="mb-5">
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
        </h1>
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
      ) : (
        <div className="max-w-3xl">
          <WorkSection
            title="① 記載内容"
            hint="お客様が入力した内容です。まずここを読んでから対応してください。"
          >
            <DrawerContentTab detail={detail} />
          </WorkSection>

          {isMerchant && (
            <WorkSection
              title="② 登録手続き"
              hint="採番・UD追記・申請書の作成・審査結果の登録・加盟店への変換をこの案件の中で進めます。"
            >
              <DrawerProcedureTab
                detail={detail}
                saving={saving}
                onSave={handleSave}
                onRefresh={handleRefresh}
              />
            </WorkSection>
          )}

          <WorkSection
            title={isMerchant ? "③ 対応の記録" : "② 対応の記録"}
            hint="連絡・対応したらメモを記録してください。新規の案件はメモを記録した時点で「対応中」に自動で進みます。"
          >
            <DrawerManageTab
              detail={detail}
              assignees={assignees}
              saving={saving}
              onSave={handleSave}
              onRefresh={handleRefresh}
            />
          </WorkSection>
        </div>
      )}
    </PortalLayout>
  );
}
