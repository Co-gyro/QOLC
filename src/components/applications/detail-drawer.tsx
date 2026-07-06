/**
 * 申請詳細ドロワー
 *
 * 「お客様の入力内容を見る」「対応の進行を管理する」「加盟店登録の手続きを進める」を
 * 混ぜないよう、3つのタブに分離する:
 * - 申請内容: 対応フロー現在地・申請者情報・フォーム入力内容（payload）
 * - 進行管理: 状態/担当者/優先度/期限/次アクション・対応メモ・変更履歴
 * - 登録手続き（加盟店申請のみ）: 申請工程・UD追記情報・審査結果・加盟店変換
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { DrawerContentTab, DrawerManageTab, DrawerProcedureTab } from "./detail-drawer-tabs";
import { fetchApplicationDetail, patchApplication } from "@/lib/applications/client";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import type { ApplicationDetail, AssigneeOption, ApplicationPatch } from "@/lib/applications/types";

export interface DetailDrawerProps {
  applicationId: string | null;
  assignees: AssigneeOption[];
  onClose: () => void;
  /** 保存後に一覧を再取得させるためのコールバック */
  onSaved: () => void;
}

type DrawerTab = "content" | "manage" | "procedure";

export function DetailDrawer({ applicationId, assignees, onClose, onSaved }: DetailDrawerProps) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<DrawerTab>("content");

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
    setTab("content");
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

  const tabs: Array<{ key: DrawerTab; label: string }> = [
    { key: "content", label: "申請内容" },
    { key: "manage", label: "進行管理" },
    ...(isMerchantApply ? [{ key: "procedure" as const, label: "登録手続き" }] : []),
  ];

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
        <div className="flex items-center justify-between mb-3">
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
          <div key={detail.id}>
            <div
              className="flex gap-1 mb-5 border-b sticky top-0 bg-white z-10"
              style={{ borderColor: "var(--qolc-border)" }}
              role="tablist"
            >
              {tabs.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  className="px-3 py-2 text-sm min-h-[44px]"
                  style={
                    tab === t.key
                      ? {
                          color: "var(--qolc-primary)",
                          borderBottom: "3px solid var(--qolc-primary)",
                          fontWeight: 700,
                        }
                      : { color: "var(--qolc-muted)" }
                  }
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "content" && <DrawerContentTab detail={detail} />}
            {tab === "manage" && (
              <DrawerManageTab
                detail={detail}
                assignees={assignees}
                saving={saving}
                onSave={handleSave}
                onRefresh={handleRefresh}
              />
            )}
            {tab === "procedure" && isMerchantApply && (
              <DrawerProcedureTab
                detail={detail}
                saving={saving}
                onSave={handleSave}
                onRefresh={handleRefresh}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
