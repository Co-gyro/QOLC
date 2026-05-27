"use client";

import { useEffect, useState, useCallback } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ResidentFormDialog } from "@/components/forms/resident-form-dialog";
import { InviteDialog } from "@/components/forms/invite-dialog";
import {
  fetchResidents,
  getMyFacilityId,
  softDeleteResident,
  type ResidentRow,
} from "@/lib/portal/facility-queries";

export default function FacilityResidentsPage() {
  const [rows, setRows] = useState<ResidentRow[] | null>(null);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ResidentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResidentRow | null>(null);
  const [inviteTarget, setInviteTarget] = useState<ResidentRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [fid, residents] = await Promise.all([getMyFacilityId(), fetchResidents()]);
      setFacilityId(fid);
      setRows(residents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setRows([]);
    }
  }, []);

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
      await softDeleteResident(deleteTarget.id);
      setDeleteTarget(null);
      setRows(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
      setDeleteTarget(null);
    }
  }

  const canCreate = !!facilityId;

  return (
    <PortalLayout portal="facility">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/facility/dashboard" }, { label: "入居者管理" }]} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">入居者管理</h1>
        <button
          className="qolc-btn px-4 py-2 rounded text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: "var(--qolc-primary)" }}
          disabled={!canCreate}
          title={!canCreate ? "施設に紐づくアカウントでログインしてください" : undefined}
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          + 入居者を登録
        </button>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{error}</p>}
      {!canCreate && rows && (
        <p className="text-sm mb-3" style={{ color: "#B45309" }}>
          施設に紐づくアカウントではないため、入居者の登録はできません（閲覧のみ）。
        </p>
      )}

      {!rows ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState
          title="入居者がまだ登録されていません"
          description="「入居者を登録」から追加してください。"
        />
      ) : (
        <DataTable<ResidentRow>
          rowKey={(r) => r.id}
          columns={[
            {
              key: "name",
              header: "氏名",
              render: (r) => (
                <span>
                  {r.nameLast} {r.nameFirst}
                  {r.nameLastKana && (
                    <span className="ml-2 text-xs" style={{ color: "var(--qolc-muted)" }}>
                      {r.nameLastKana} {r.nameFirstKana}
                    </span>
                  )}
                </span>
              ),
            },
            { key: "insuranceNumber", header: "被保険者番号" },
            {
              key: "cardRegistered",
              header: "カード",
              render: (r) => <StatusBadge status={r.cardRegistered ? "active" : "inactive"} />,
            },
            {
              key: "accountCount",
              header: "家族アカウント",
              render: (r) => `${r.accountCount}名`,
              className: "text-right",
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
                      setInviteTarget(r);
                    }}
                  >
                    招待
                  </button>
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
          data={rows}
        />
      )}

      {facilityId && (
        <ResidentFormDialog
          open={formOpen}
          target={editTarget}
          facilityId={facilityId}
          onClose={() => setFormOpen(false)}
          onSaved={handleSaved}
        />
      )}
      <InviteDialog
        open={!!inviteTarget}
        resident={inviteTarget}
        onClose={() => setInviteTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="入居者を削除しますか？"
        description={`「${deleteTarget?.nameLast ?? ""} ${deleteTarget?.nameFirst ?? ""}」を論理削除します。決済履歴は保持されます。`}
        confirmLabel="削除する"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PortalLayout>
  );
}
