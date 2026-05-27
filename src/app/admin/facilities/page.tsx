"use client";

import { useEffect, useState, useCallback } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FacilityFormDialog } from "@/components/forms/facility-form-dialog";
import {
  fetchFacilities,
  fetchFacilityGroups,
  softDeleteFacility,
  type FacilityRow,
  type FacilityGroupOption,
} from "@/lib/portal/admin-queries";

export default function AdminFacilitiesPage() {
  const [rows, setRows] = useState<FacilityRow[] | null>(null);
  const [groups, setGroups] = useState<FacilityGroupOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FacilityRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FacilityRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [facs, grps] = await Promise.all([fetchFacilities(), fetchFacilityGroups()]);
      setRows(facs);
      setGroups(grps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }
  function openEdit(row: FacilityRow) {
    setEditTarget(row);
    setFormOpen(true);
  }
  async function handleSaved() {
    setFormOpen(false);
    setRows(null);
    await load();
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await softDeleteFacility(deleteTarget.id);
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
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "介護施設管理" }]} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">介護施設管理</h1>
        <button
          className="qolc-btn px-4 py-2 rounded text-white font-medium"
          style={{ backgroundColor: "var(--qolc-primary)" }}
          onClick={openCreate}
        >
          + 施設を登録
        </button>
      </div>

      {error && (
        <p className="text-sm mb-3" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      {!rows ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState
          title="施設がまだ登録されていません"
          description="「施設を登録」から最初の施設を追加してください。"
        />
      ) : (
        <DataTable<FacilityRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "施設名", sortable: true },
            { key: "groupName", header: "グループ", render: (r) => r.groupName ?? "—" },
            { key: "residentCount", header: "入居者数", sortable: true, className: "text-right" },
            {
              key: "displayFrequency",
              header: "表示頻度",
              render: (r) => (r.displayFrequency === "monthly" ? "月次" : "隔月"),
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
                      openEdit(r);
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
          data={rows}
        />
      )}

      <FacilityFormDialog
        open={formOpen}
        target={editTarget}
        groups={groups}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="施設を削除しますか？"
        description={`「${deleteTarget?.name ?? ""}」を削除します。入居者データが残っている場合は非表示になります（論理削除）。`}
        confirmLabel="削除する"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PortalLayout>
  );
}
