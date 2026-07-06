"use client";

/**
 * /admin/applications … 申請・相談（外部からの受付案件の一元管理）
 *
 * 種別ごとにタブを分ける: 加盟店申請（ステージ別リスト）／住み替え相談／お問い合わせ・サポート。
 * 行クリック（または ?open=<id> ディープリンク）で詳細ドロワーを開く。
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { DetailDrawer } from "@/components/applications/detail-drawer";
import { ApplicationFilters } from "@/components/applications/list-filters";
import { NewApplicationDialog } from "@/components/applications/new-application-dialog";
import { MerchantStageList } from "./_components/merchant-stage-list";
import { GenericAppTable } from "./_components/generic-app-table";
import {
  fetchApplications,
  fetchAssignees,
  type ApplicationFilters as Filters,
} from "@/lib/applications/client";
import { OPEN_STATUSES } from "@/lib/applications/labels";
import type { ApplicationRow, AssigneeOption } from "@/lib/applications/types";

/** タブ定義: 加盟店申請 / 住み替え相談 / お問い合わせ・サポート */
type TabKey = "merchant" | "consult" | "other";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "merchant", label: "加盟店申請" },
  { key: "consult", label: "住み替え相談" },
  { key: "other", label: "お問い合わせ・サポート" },
];

/** 申請の種別 → 所属タブ */
function tabOfSource(source: ApplicationRow["source"]): TabKey {
  if (source === "qolc_merchant") return "merchant";
  if (source === "jcb_consult") return "consult";
  return "other";
}

function AdminApplicationsPageInner() {
  // 「今日のUD」等からのディープリンク（?open=<申請ID>）で詳細ドロワーを直接開く
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ApplicationRow[] | null>(null);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  /** 「未対応のみ」既定 ON（住み替え相談・お問い合わせタブで使用） */
  const [openOnly, setOpenOnly] = useState(true);
  const [tab, setTab] = useState<TabKey>("merchant");
  /** ディープリンク時に一度だけ、開いた案件の種別タブへ合わせる */
  const [tabSynced, setTabSynced] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("open") || null
  );
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [apps, asg] = await Promise.all([fetchApplications(filters), fetchAssignees()]);
      setRows(apps);
      setAssignees(asg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setRows([]);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tabSynced || !selectedId || !rows) return;
    const target = rows.find((r) => r.id === selectedId);
    if (target) setTab(tabOfSource(target.source));
    setTabSynced(true);
  }, [rows, selectedId, tabSynced]);

  /** タブの種別で絞った行 */
  const tabRows = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) => tabOfSource(r.source) === tab);
  }, [rows, tab]);

  /** 「未対応のみ」フィルタ（加盟店申請タブはステージ別に全段階を見せるため適用しない） */
  const visible = useMemo(() => {
    if (!tabRows) return null;
    if (tab === "merchant" || !openOnly || filters.status) return tabRows;
    return tabRows.filter((r) => OPEN_STATUSES.includes(r.status));
  }, [tabRows, tab, openOnly, filters.status]);

  const countOf = useCallback(
    (key: TabKey) => rows?.filter((r) => tabOfSource(r.source) === key).length ?? 0,
    [rows]
  );

  return (
    <PortalLayout portal="admin">
      <Breadcrumb
        items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "申請・相談" }]}
      />
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">申請・相談</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--qolc-muted)" }}>
            公開フォーム等から届いた案件を種別ごとに管理します。電話受付は「新規案件を起票」でその場で記録できます。
          </p>
        </div>
        <button
          className="qolc-btn px-4 rounded text-white font-medium"
          style={{ backgroundColor: "var(--qolc-primary)", minHeight: 44 }}
          onClick={() => setCreating(true)}
        >
          + 新規案件を起票
        </button>
      </div>

      {/* 種別タブ */}
      <div
        className="flex gap-1 mb-4 border-b overflow-x-auto"
        style={{ borderColor: "var(--qolc-border)" }}
        role="tablist"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className="px-4 py-2 text-sm whitespace-nowrap min-h-[44px]"
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
            {t.label}（{countOf(t.key)}）
          </button>
        ))}
      </div>

      <ApplicationFilters
        filters={filters}
        assignees={assignees}
        openOnly={openOnly}
        onChange={setFilters}
        onOpenOnlyChange={setOpenOnly}
        hideSource
        hideOpenOnly={tab === "merchant"}
      />

      {error && (
        <p className="text-sm my-3" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      {!visible ? (
        <LoadingSpinner />
      ) : tab === "merchant" ? (
        <MerchantStageList rows={visible} onSelect={setSelectedId} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="該当する案件がありません"
          description="フィルタ条件を変更するか、公開フォームからの受付をお待ちください。"
        />
      ) : (
        <GenericAppTable rows={visible} showSource={tab === "other"} onSelect={setSelectedId} />
      )}

      <DetailDrawer
        applicationId={selectedId}
        assignees={assignees}
        onClose={() => setSelectedId(null)}
        onSaved={() => void load()}
      />
      <NewApplicationDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => void load()}
      />
    </PortalLayout>
  );
}

export default function AdminApplicationsPage() {
  // useSearchParams はプリレンダ時に Suspense 境界が必須
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AdminApplicationsPageInner />
    </Suspense>
  );
}
