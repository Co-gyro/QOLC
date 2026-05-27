"use client";

import { useEffect, useState, useCallback } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UploadFormatDialog } from "@/components/forms/upload-format-dialog";
import {
  fetchUploadFormatsDetailed,
  fetchPoolAvailability,
  deleteUploadFormat,
  type UploadFormatDetail,
  type PoolAvailability,
} from "@/lib/portal/admin-queries";

function PoolCard({ title, sub, a }: { title: string; sub: string; a: { available: number; assigned: number; total: number } }) {
  const low = a.total > 0 && a.available / a.total < 0.1;
  return (
    <Card style={low ? { borderColor: "#DC2626", borderWidth: 2 } : undefined}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-2">{sub}</p>
        <p className="text-2xl font-bold" style={{ color: low ? "#DC2626" : "var(--qolc-primary)" }}>
          残 {a.available.toLocaleString("ja-JP")} / {a.total.toLocaleString("ja-JP")}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--qolc-muted)" }}>
          払い出し済み {a.assigned.toLocaleString("ja-JP")}
          {low && <span style={{ color: "#DC2626" }}> ・残り僅少</span>}
        </p>
      </CardContent>
    </Card>
  );
}

export default function AdminMasterPage() {
  const [pool, setPool] = useState<PoolAvailability | null>(null);
  const [formats, setFormats] = useState<UploadFormatDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UploadFormatDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UploadFormatDetail | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, f] = await Promise.all([fetchPoolAvailability(), fetchUploadFormatsDetailed()]);
      setPool(p);
      setFormats(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setFormats([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaved() {
    setFormOpen(false);
    setFormats(null);
    await load();
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUploadFormat(deleteTarget.id);
      setDeleteTarget(null);
      setFormats(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
      setDeleteTarget(null);
    }
  }

  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "マスタ管理" }]} />
      <h1 className="text-2xl font-bold mb-6">マスタ管理</h1>

      {error && <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{error}</p>}

      {/* プール残数（実データ） */}
      <h2 className="text-lg font-semibold mb-3">USENコードプール残数</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {!pool ? (
          <LoadingSpinner />
        ) : (
          <>
            <PoolCard title="モールコード" sub="A300〜A3ZZ" a={pool.mallCode} />
            <PoolCard title="端末識別番号" sub="3124620001000〜" a={pool.terminalId} />
          </>
        )}
      </div>

      {/* アップロードフォーマット CRUD */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">アップロードフォーマット</h2>
        <button
          className="qolc-btn px-4 py-2 rounded text-white font-medium"
          style={{ backgroundColor: "var(--qolc-primary)" }}
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          + フォーマットを登録
        </button>
      </div>

      {!formats ? (
        <LoadingSpinner />
      ) : formats.length === 0 ? (
        <EmptyState
          title="フォーマットが未登録です"
          description="提供者の明細CSVの列対応を定義するフォーマットを登録してください（加盟店に紐付けて使用）。"
        />
      ) : (
        <DataTable<UploadFormatDetail>
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "名称", sortable: true },
            { key: "description", header: "説明", render: (r) => r.description ?? "—" },
            {
              key: "mapping",
              header: "被保険者番号の列",
              render: (r) => r.mapping.insurance_number ?? "—",
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
          data={formats}
        />
      )}

      <UploadFormatDialog
        open={formOpen}
        target={editTarget}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="フォーマットを削除しますか？"
        description={`「${deleteTarget?.name ?? ""}」を削除します。加盟店が使用中の場合は削除できません。`}
        confirmLabel="削除する"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PortalLayout>
  );
}
