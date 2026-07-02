/**
 * 申請詳細ドロワー
 *
 * 申請内容(payload) + 変更履歴タイムライン + 操作フォーム
 * （状態/担当者/優先度/期限/次アクション）を右側スライドインで表示する。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EventTimeline } from "./event-timeline";
import { PayloadView } from "./payload-view";
import { EditForm } from "./detail-edit-form";
import {
  fetchApplicationDetail,
  patchApplication,
  type ApplicationFilters,
} from "@/lib/applications/client";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import type { ApplicationDetail, AssigneeOption, ApplicationPatch } from "@/lib/applications/types";

export interface DetailDrawerProps {
  applicationId: string | null;
  assignees: AssigneeOption[];
  onClose: () => void;
  /** 保存後に一覧を再取得させるためのコールバック */
  onSaved: () => void;
}

export function DetailDrawer({ applicationId, assignees, onClose, onSaved }: DetailDrawerProps) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (id: string) => {
    setError(null);
    setDetail(null);
    try {
      setDetail(await fetchApplicationDetail(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, []);

  useEffect(() => {
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

  if (!applicationId) return null;

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
          <button className="text-sm underline" onClick={onClose} aria-label="閉じる">
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
          <div className="flex flex-col gap-6">
            <section>
              <h3 className="text-sm font-bold mb-2" style={{ color: "var(--qolc-primary)" }}>
                申請者
              </h3>
              <dl className="grid grid-cols-1 gap-1 text-sm">
                <Field label="お名前" value={detail.applicantName} />
                <Field label="所属" value={detail.applicantOrg} />
                <Field label="メール" value={detail.applicantEmail} />
                <Field label="電話" value={detail.applicantPhone} />
                <Field label="ご連絡内容" value={detail.message} />
              </dl>
            </section>

            <section>
              <h3 className="text-sm font-bold mb-2" style={{ color: "var(--qolc-primary)" }}>
                対応
              </h3>
              <EditForm detail={detail} assignees={assignees} saving={saving} onSave={handleSave} />
            </section>

            <section>
              <h3 className="text-sm font-bold mb-2" style={{ color: "var(--qolc-primary)" }}>
                申請内容
              </h3>
              <PayloadView payload={detail.payload} />
            </section>

            <section>
              <h3 className="text-sm font-bold mb-2" style={{ color: "var(--qolc-primary)" }}>
                変更履歴
              </h3>
              <EventTimeline events={detail.events} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/** ラベル + 値の1行表示（値が空なら "—"） */
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs" style={{ color: "var(--qolc-muted)" }}>
        {label}
      </dt>
      <dd className="whitespace-pre-wrap break-words" style={{ color: "var(--qolc-text)" }}>
        {value?.trim() || "—"}
      </dd>
    </div>
  );
}
