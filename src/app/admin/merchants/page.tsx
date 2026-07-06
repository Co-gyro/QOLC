"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MerchantFormDialog } from "@/components/forms/merchant-form-dialog";
import {
  fetchMerchants,
  fetchUploadFormats,
  softDeleteMerchant,
  type MerchantRow,
  type UploadFormatOption,
} from "@/lib/portal/admin-queries";
import { fetchMerchantCardCodes, type MerchantCardCodes } from "./_lib/card-codes";
import { CardCodesCell } from "./_components/card-codes-cell";
import { CardCodesDialog } from "./_components/card-codes-dialog";
import { RelationsCell } from "./_components/relations-cell";
import {
  fetchMerchantRelations,
  type MerchantRelations,
} from "@/lib/portal/merchant-relations";

function AdminMerchantsPageInner() {
  // 業務タスク詳細などからの遷移時に該当加盟店を先頭に出す（?highlight=<加盟店ID>）
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [rows, setRows] = useState<MerchantRow[] | null>(null);
  const [formats, setFormats] = useState<UploadFormatOption[]>([]);
  const [codes, setCodes] = useState<Map<string, MerchantCardCodes>>(new Map());
  const [relations, setRelations] = useState<Map<string, MerchantRelations>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MerchantRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MerchantRow | null>(null);
  const [codesTarget, setCodesTarget] = useState<MerchantRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mers, fmts, codeMap, rel] = await Promise.all([
        fetchMerchants(),
        fetchUploadFormats(),
        fetchMerchantCardCodes(),
        fetchMerchantRelations(), // 内部で空 Map フォールバック
      ]);
      setRows(mers);
      setFormats(fmts);
      setCodes(codeMap);
      setRelations(rel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setRows([]);
    }
  }, []);

  /** ハイライト対象を先頭に出した表示用の行（対象なしなら元の順序のまま） */
  const displayRows = useMemo(() => {
    if (!rows || !highlightId) return rows;
    const hit = rows.find((r) => r.id === highlightId);
    if (!hit) return rows;
    return [hit, ...rows.filter((r) => r.id !== highlightId)];
  }, [rows, highlightId]);

  const highlighted = highlightId && rows?.find((r) => r.id === highlightId);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaved() {
    setFormOpen(false);
    setRows(null);
    await load();
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await softDeleteMerchant(deleteTarget.id);
      setDeleteTarget(null);
      setRows(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
      setDeleteTarget(null);
    }
  }

  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "加盟店管理" }]} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">加盟店管理</h1>
        <div className="flex gap-2">
          <a
            href="/admin/merchant-application"
            className="qolc-btn px-4 py-2 rounded border inline-block"
            style={{ borderColor: "var(--qolc-border)" }}
          >
            申請書を出力
          </a>
          <button
            className="qolc-btn px-4 py-2 rounded text-white font-medium"
            style={{ backgroundColor: "var(--qolc-primary)" }}
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            + 加盟店を登録
          </button>
        </div>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{error}</p>}

      {highlighted && (
        <p
          className="text-sm mb-3 rounded-md px-4 py-2 font-medium"
          style={{ backgroundColor: "var(--qolc-bg-soft)", color: "var(--qolc-primary)" }}
        >
          業務タスクから遷移: 「{highlighted.name}」を先頭に表示しています。
        </p>
      )}

      {!displayRows ? (
        <LoadingSpinner />
      ) : displayRows.length === 0 ? (
        <EmptyState title="加盟店がまだ登録されていません" description="「加盟店を登録」から追加してください。" />
      ) : (
        <DataTable<MerchantRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "加盟店名", sortable: true },
            { key: "mallCode", header: "モールコード", render: (r) => r.mallCode ?? "—" },
            { key: "terminalId", header: "端末番号", render: (r) => r.terminalId ?? "—" },
            {
              key: "cardCodes",
              header: "加盟店番号（JCB2種/セゾン）",
              render: (r) => (
                <CardCodesCell
                  codes={codes.get(r.id) ?? null}
                  onEdit={() => setCodesTarget(r)}
                />
              ),
            },
            { key: "facilityCount", header: "提携施設数", sortable: true, className: "text-right" },
            {
              key: "relations",
              header: "関連案件（申請・タスク）",
              render: (r) => <RelationsCell relations={relations.get(r.id) ?? null} />,
            },
            {
              key: "actions",
              header: "操作",
              render: (r) => (
                <div className="flex gap-2">
                  <button
                    className="text-sm underline"
                    style={{ color: "var(--qolc-primary)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditTarget(r);
                      setFormOpen(true);
                    }}
                  >
                    編集
                  </button>
                  <button
                    className="text-sm underline"
                    style={{ color: "#DC2626" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(r);
                    }}
                  >
                    削除
                  </button>
                </div>
              ),
            },
          ]}
          data={displayRows}
        />
      )}

      <MerchantFormDialog
        open={formOpen}
        target={editTarget}
        formats={formats}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />
      <CardCodesDialog
        open={!!codesTarget}
        merchantId={codesTarget?.id ?? null}
        merchantName={codesTarget?.name ?? ""}
        current={codesTarget ? codes.get(codesTarget.id) ?? null : null}
        onClose={() => setCodesTarget(null)}
        onSaved={() => {
          setCodesTarget(null);
          void load();
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="加盟店を削除しますか？"
        description={`「${deleteTarget?.name ?? ""}」を論理削除します。払い出し済みのコードは保持されます。`}
        confirmLabel="削除する"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PortalLayout>
  );
}

export default function AdminMerchantsPage() {
  // useSearchParams はプリレンダ時に Suspense 境界が必須
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AdminMerchantsPageInner />
    </Suspense>
  );
}
