"use client";

/**
 * 加盟店申請タブのステージ別リスト。
 * 「新規受付→UD対応中→審査提出中→結果受領・登録処理→完了・却下」の実務フロー順に
 * セクション分けし、各申請が今どの段階かをひと目で示す。
 */
import { DataTable } from "@/components/shared/data-table";
import { StatusPill } from "@/components/applications/hub-badge";
import {
  groupByMerchantStage,
  MERCHANT_STAGE_ORDER,
  MERCHANT_STAGE_LABELS,
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
  const grouped = groupByMerchantStage(rows);
  return (
    <div className="flex flex-col gap-8">
      {MERCHANT_STAGE_ORDER.map((stage, i) => {
        const { title, description } = MERCHANT_STAGE_LABELS[stage];
        const items = grouped.get(stage) ?? [];
        return (
          <section key={stage}>
            <div className="flex items-baseline gap-2 mb-1">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ backgroundColor: "var(--qolc-primary)", color: "white" }}
              >
                {i + 1}
              </span>
              <h3 className="text-base font-bold" style={{ color: "var(--qolc-text)" }}>
                {title}
              </h3>
              <span className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                {items.length}件
              </span>
            </div>
            <p className="text-sm mb-2 ml-9" style={{ color: "var(--qolc-muted)" }}>
              {description}
            </p>
            {items.length === 0 ? (
              <p
                className="text-sm ml-9 border rounded-md px-4 py-3"
                style={{ color: "var(--qolc-muted)", borderColor: "var(--qolc-border)" }}
              >
                この段階の申請はありません。
              </p>
            ) : (
              <DataTable<ApplicationRow>
                rowKey={(r) => r.id}
                onRowClick={(r) => onSelect(r.id)}
                columns={[
                  {
                    key: "applicant",
                    header: "申請者",
                    render: (r) => (
                      <div className="flex flex-col">
                        <span className="font-medium">{r.applicantName ?? "—"}</span>
                        {r.applicantOrg && (
                          <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
                            {r.applicantOrg}
                          </span>
                        )}
                      </div>
                    ),
                  },
                  { key: "status", header: "状態", render: (r) => <StatusPill status={r.status} /> },
                  {
                    key: "assignee",
                    header: "担当者",
                    render: (r) =>
                      r.assigneeName ?? (
                        <span style={{ color: "var(--qolc-muted)" }}>未割当</span>
                      ),
                  },
                  { key: "due", header: "期限", render: (r) => fmtDate(r.dueDate) },
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
                  { key: "created", header: "受付日", render: (r) => fmtDate(r.createdAt) },
                ]}
                data={items}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
