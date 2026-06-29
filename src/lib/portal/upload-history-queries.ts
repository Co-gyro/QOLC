/**
 * アップロード履歴（upload_batches）の取得（RLSで自動スコープ）
 * - admin: 全件
 * - provider: 自加盟店のバッチ
 * - facility_staff: 提携加盟店のバッチ
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UploadStatus } from "@/types";

export interface UploadBatchRow {
  id: string;
  fileName: string | null;
  providerType: string;
  totalRows: number;
  totalAmount: number;
  status: UploadStatus;
  merchantName: string;
  createdAt: string;
}

interface RawBatch {
  id: string;
  file_name: string | null;
  provider_type: string;
  total_rows: number | null;
  total_amount: number | null;
  status: UploadStatus;
  created_at: string;
  merchants: { name: string | null } | null;
}

export async function fetchUploadBatches(limit = 100): Promise<UploadBatchRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("upload_batches")
    .select("id, file_name, provider_type, total_rows, total_amount, status, created_at, merchants(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`アップロード履歴の取得に失敗しました: ${error.message}`);
  const rows = (data ?? []) as unknown as RawBatch[];
  return rows.map((r) => ({
    id: r.id,
    fileName: r.file_name,
    providerType: r.provider_type,
    totalRows: r.total_rows ?? 0,
    totalAmount: r.total_amount ?? 0,
    status: r.status,
    merchantName: r.merchants?.name ?? "—",
    createdAt: r.created_at,
  }));
}

/** upload_status の日本語ラベルと色 */
export const UPLOAD_STATUS_LABEL: Record<string, string> = {
  processing: "取込み中",
  preview: "確認待ち",
  confirmed: "確認済み",
  completed: "決済完了",
  error: "エラー",
};

/** 各状態の意味（凡例・詳細表示用） */
export const UPLOAD_STATUS_DESCRIPTION: Record<string, string> = {
  processing: "ファイルを取込み中です（通常はすぐに確認待ちへ進みます）。",
  preview: "取込み済みで決済はまだです。内容を確認し、その他費用の追加や決済実行ができます。",
  confirmed: "内容が確認済みです。",
  completed: "決済を実行済みです。領収書を発行できます。",
  error: "取込みに失敗しました。ファイル形式をご確認のうえ再アップロードしてください。",
};

export const UPLOAD_STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  processing: { bg: "#FFF7E6", fg: "#B45309" },
  preview: { bg: "#E0F2FE", fg: "#0369A1" },
  confirmed: { bg: "#E0F2FE", fg: "#0369A1" },
  completed: { bg: "#E6F4EA", fg: "#1B5E20" },
  error: { bg: "#FEE2E2", fg: "#991B1B" },
};
