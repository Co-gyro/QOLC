"use client";

/**
 * アップロードフローの表示部品（UploadFlow から分離）。
 * - UploadSlot: ①明細・②その他費用のドロップ枠
 * - PreviewCard: 取込みプレビュー（施設別→入居者別、未マッチ含む）
 * - ResultStat: 決済実行結果の集計タイル
 */
import { FileUpload } from "@/components/shared/file-upload";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PreviewResult } from "@/lib/upload/preview";

/** 金額を「¥1,234」形式にフォーマットする */
export const yen = (n: number): string => `¥${n.toLocaleString("ja-JP")}`;

/** 1つのアップロード枠（明細 / その他費用） */
export function UploadSlot({
  badge,
  title,
  description,
  helperText,
  loading,
  onFile,
  dashed = false,
}: {
  badge: string;
  title: string;
  description: string;
  helperText: string;
  loading: boolean;
  onFile: (file: File) => void;
  dashed?: boolean;
}) {
  return (
    <Card style={dashed ? { borderColor: "var(--qolc-border)", borderStyle: "dashed" } : undefined}>
      <CardHeader>
        <CardTitle className="text-base">
          <span className="mr-2" style={{ color: "var(--qolc-primary)" }}>{badge}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-3" style={{ color: "var(--qolc-muted)" }}>{description}</p>
        {loading ? (
          <div className="py-4 flex justify-center">
            <LoadingSpinner size="md" label="取込み中..." />
          </div>
        ) : (
          <FileUpload onFile={onFile} helperText={helperText} />
        )}
      </CardContent>
    </Card>
  );
}

/** 取込みプレビュー（マッチ/未マッチの内訳と合計） */
export function PreviewCard({ preview }: { preview: PreviewResult }) {
  const matchedCount = preview.facilities.reduce((s, f) => s + f.residents.length, 0);
  const unmatchedCount =
    preview.facilities.reduce((s, f) => s + f.unmatched.length, 0) + preview.unmatched.length;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>
          プレビュー（マッチ {matchedCount}名 / 未マッチ {unmatchedCount}件 / 合計{" "}
          {yen(preview.totalAmount)}）
        </CardTitle>
      </CardHeader>
      <CardContent>
        {preview.facilities.length === 0 && preview.unmatched.length === 0 && (
          <p style={{ color: "var(--qolc-muted)" }}>明細がありませんでした。</p>
        )}

        {preview.facilities.map((f) => (
          <div key={f.facilityId ?? "none"} className="mb-6 last:mb-0">
            <h3 className="font-semibold text-lg mb-2">
              {f.facilityName}
              <span className="ml-2 text-sm font-normal" style={{ color: "var(--qolc-muted)" }}>
                （{f.residents.length}名、合計 {yen(f.totalAmount)}）
              </span>
            </h3>
            <ul className="ml-4 space-y-1">
              {f.residents.map((r) => (
                <li key={r.residentId} className="flex justify-between border-b py-1 text-sm">
                  <span>├ {r.residentName}</span>
                  <span className="font-medium">{yen(r.totalAmount)}</span>
                </li>
              ))}
              {f.unmatched.map((u) => (
                <li
                  key={u.statementLineId}
                  className="flex justify-between border-b py-1 text-sm"
                  style={{ color: "#B45309" }}
                >
                  <span>？被保険者番号: {u.insuranceNumber || "(空)"}</span>
                  <span>
                    {yen(u.amount)} <StatusBadge status={u.matchStatus} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {preview.unmatched.length > 0 && (
          <div className="mt-4 p-3 rounded" style={{ backgroundColor: "#FFF7E6" }}>
            <p className="font-semibold mb-2" style={{ color: "#B45309" }}>
              施設未確定（{preview.unmatched.length}件）
            </p>
            <ul className="ml-2 space-y-1 text-sm">
              {preview.unmatched.map((u) => (
                <li key={u.statementLineId} className="flex justify-between">
                  <span>被保険者番号: {u.insuranceNumber || "(空)"}</span>
                  <span>
                    {yen(u.amount)} <StatusBadge status={u.matchStatus} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** 決済実行結果の集計タイル */
export function ResultStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="border rounded-md p-3 text-center" style={{ borderColor: "var(--qolc-border)" }}>
      <div className="text-2xl font-bold" style={{ color: color ?? "var(--qolc-text)" }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--qolc-muted)" }}>
        {label}
      </div>
    </div>
  );
}
