"use client";

/**
 * 申請ハブの共有一覧ビュー（業務ファースト構成）
 *
 * /admin/applications（加盟店申請・登録）と /admin/inquiries（相談・問い合わせ）が
 * タブ定義（hub-tabs.ts）を渡して共用する。行クリックで案件詳細ページへ遷移する
 * （ドロワーは廃止。旧リンクの ?open=<id> は詳細ページへリダイレクト）。
 * 起票ダイアログは現在のタブの種別に固定し、業務に合わない種別を選ばせない。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { ApplicationFilters } from "@/components/applications/list-filters";
import { NewApplicationDialog } from "@/components/applications/new-application-dialog";
import { MerchantStageList } from "@/app/admin/applications/_components/merchant-stage-list";
import { GenericAppTable } from "@/app/admin/applications/_components/generic-app-table";
import {
  fetchApplications,
  fetchAssignees,
  type ApplicationFilters as Filters,
} from "@/lib/applications/client";
import { OPEN_STATUSES } from "@/lib/applications/labels";
import { tabKeyOfSource, type HubTabDef } from "@/lib/applications/hub-tabs";
import type { ApplicationRow, AssigneeOption } from "@/lib/applications/types";

export interface HubViewProps {
  /** ページ見出し（例: 相談・問い合わせ） */
  title: string;
  /** 見出し下の説明文 */
  description: string;
  /** このページのパス（詳細ページ /<basePath>/<id> への遷移に使う） */
  basePath: string;
  /** このページが持つタブ（1つならタブバーは表示しない） */
  tabs: readonly HubTabDef[];
}

export function ApplicationsHubView({ title, description, basePath, tabs }: HubViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ApplicationRow[] | null>(null);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  /** 「未対応のみ」既定 ON（テーブル型タブで使用） */
  const [openOnly, setOpenOnly] = useState(true);
  const [tabKey, setTabKey] = useState<string>(tabs[0]?.key ?? "");
  const [creating, setCreating] = useState(false);

  // 旧リンク互換: ?open=<id> は詳細ページへ引き継ぐ
  useEffect(() => {
    const open = searchParams.get("open");
    if (open) router.replace(`${basePath}/${open}`);
  }, [searchParams, router, basePath]);

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

  const tab = useMemo(
    () => tabs.find((t) => t.key === tabKey) ?? tabs[0],
    [tabs, tabKey]
  );

  /** このページの対象 source に絞った行（他ページの案件は数えない） */
  const pageRows = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) => tabKeyOfSource(tabs, r.source) !== null);
  }, [rows, tabs]);

  /** 現在タブの行 */
  const tabRows = useMemo(() => {
    if (!pageRows || !tab) return null;
    return pageRows.filter((r) => tabKeyOfSource(tabs, r.source) === tab.key);
  }, [pageRows, tabs, tab]);

  /** 「未対応のみ」フィルタ（ステージ導出型リストは全段階を見せるため適用しない） */
  const visible = useMemo(() => {
    if (!tabRows || !tab) return null;
    if (tab.layout === "stage" || !openOnly || filters.status) return tabRows;
    return tabRows.filter((r) => OPEN_STATUSES.includes(r.status));
  }, [tabRows, tab, openOnly, filters.status]);

  const countOf = useCallback(
    (key: string) =>
      pageRows?.filter((r) => tabKeyOfSource(tabs, r.source) === key).length ?? 0,
    [pageRows, tabs]
  );

  /** 行クリック → 案件詳細ページ（作業ページ）へ */
  const openDetail = useCallback(
    (id: string) => router.push(`${basePath}/${id}`),
    [router, basePath]
  );

  if (!tab) return null;

  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "今日のUD", href: "/admin/today" }, { label: title }]} />
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--qolc-muted)" }}>
            {description}
          </p>
        </div>
        <button
          className="qolc-btn px-4 rounded text-white font-medium"
          style={{ backgroundColor: "var(--qolc-primary)", minHeight: 44 }}
          onClick={() => setCreating(true)}
        >
          + {tab.label}を起票
        </button>
      </div>

      {tabs.length > 1 && (
        <div
          className="flex gap-1 mb-3 border-b overflow-x-auto"
          style={{ borderColor: "var(--qolc-border)" }}
          role="tablist"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab.key === t.key}
              className="px-4 py-2 text-sm whitespace-nowrap min-h-[44px]"
              style={
                tab.key === t.key
                  ? {
                      color: "var(--qolc-primary)",
                      borderBottom: "3px solid var(--qolc-primary)",
                      fontWeight: 700,
                    }
                  : { color: "var(--qolc-muted)" }
              }
              onClick={() => setTabKey(t.key)}
            >
              {t.label}（{countOf(t.key)}）
            </button>
          ))}
        </div>
      )}

      {tab.hint && (
        <p className="text-sm mb-3" style={{ color: "var(--qolc-muted)" }}>
          {tab.hint}
        </p>
      )}

      <ApplicationFilters
        filters={filters}
        assignees={assignees}
        openOnly={openOnly}
        onChange={setFilters}
        onOpenOnlyChange={setOpenOnly}
        hideSource
        hideOpenOnly={tab.layout === "stage"}
      />

      {error && (
        <p className="text-sm my-3" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      {!visible ? (
        <LoadingSpinner />
      ) : tab.layout === "stage" ? (
        <MerchantStageList rows={visible} onSelect={openDetail} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="該当する案件がありません"
          description="フィルタ条件を変更するか、公開フォームからの受付をお待ちください。"
        />
      ) : (
        <GenericAppTable rows={visible} showSource={!!tab.showSource} onSelect={openDetail} />
      )}

      <NewApplicationDialog
        open={creating}
        sources={tab.sources}
        contextLabel={tab.label}
        onClose={() => setCreating(false)}
        onCreated={() => void load()}
      />
    </PortalLayout>
  );
}
