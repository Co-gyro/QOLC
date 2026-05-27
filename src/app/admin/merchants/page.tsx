"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function AdminMerchantsPage() {
  const [rows, setRows] = useState<MerchantRow[] | null>(null);
  const [formats, setFormats] = useState<UploadFormatOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MerchantRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MerchantRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mers, fmts] = await Promise.all([fetchMerchants(), fetchUploadFormats()]);
      setRows(mers);
      setFormats(fmts);
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

      {!rows ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="加盟店がまだ登録されていません" description="「加盟店を登録」から追加してください。" />
      ) : (
        <DataTable<MerchantRow>
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "加盟店名", sortable: true },
            { key: "mallCode", header: "モールコード", render: (r) => r.mallCode ?? "—" },
            { key: "terminalId", header: "端末番号", render: (r) => r.terminalId ?? "—" },
            { key: "facilityCount", header: "提携施設数", sortable: true, className: "text-right" },
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
          data={rows}
        />
      )}

      <MerchantFormDialog
        open={formOpen}
        target={editTarget}
        formats={formats}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
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
