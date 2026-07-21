"use client";

/**
 * 加盟店申請・登録の案件一覧（単一リスト）
 *
 * ステージ別のセクション分けはやめ、モック合意（2026-07-21）どおり
 * 全案件を1つのリストで表示する。「いま何を待っているか」列は
 * 作業の進み具合（merchant-stage.ts）から自動導出し、手動更新はさせない。
 * 並び順は実務フロー順→受付日の古い順。
 */
import { DataTable } from "@/components/shared/data-table";
import {
  deriveMerchantStage,
  compareByMerchantStage,
  MERCHANT_STAGE_WAITING,
  MERCHANT_STAGE_COLORS,
} from "@/lib/applications/merchant-stage";
import type { ApplicationRow } from "@/lib/applications/types";

/** ISO 日時 → "YYYY/MM/DD" */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

export interface MerchantStageListProps {
  rows: ApplicationRow[];
  onSelect: (id: string) => void;
}

export function MerchantStageList({ rows, onSelect }: MerchantStageListProps) {
  const sorted = [...rows].sort(compareByMerchantStage);
  return (
    <DataTable<ApplicationRow>
      rowKey={(r) => r.id}
      onRowClick={(r) => onSelect(r.id)}
      columns={[
        {
          key: "applicant",
          header: "事業者",
          render: (r) => (
            <div className="flex flex-col">
              <span className="font-medium">{r.applicantOrg ?? r.applicantName ?? "—"}</span>
              {r.applicantOrg && r.applicantName && (
                <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
                  {r.applicantName}
                </span>
              )}
            </div>
          ),
        },
        { key: "created", header: "受付日", render: (r) => fmtDate(r.createdAt) },
        {
          key: "stage",
          header: "いま何を待っているか",
          render: (r) => {
            const stage = deriveMerchantStage(r);
            const c = MERCHANT_STAGE_COLORS[stage];
            return (
              <span
                className="text-sm px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                style={{ backgroundColor: c.bg, color: c.fg }}
              >
                {MERCHANT_STAGE_WAITING[stage]}
              </span>
            );
          },
        },
        {
          key: "assignee",
          header: "担当",
          render: (r) =>
            r.assigneeName ?? <span style={{ color: "var(--qolc-muted)" }}>未割当</span>,
        },
        {
          key: "next",
          header: "次アクション",
          render: (r) =>
            r.nextAction ? (
              <span className="font-medium" style={{ color: "var(--qolc-primary)" }}>
                {r.nextAction}
              </span>
            ) : (
              <span style={{ color: "var(--qolc-muted)" }}>—</span>
            ),
        },
      ]}
      data={sorted}
    />
  );
}
