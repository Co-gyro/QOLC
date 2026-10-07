"use client";

/**
 * 運営センター：明細の突合の結果（照合済み・要確認・対象外、明細に現れていない記録）。
 */
import { DataTable } from "@/components/shared/data-table";
import type { ReviewDeclaration, ReviewLine, StatementReview } from "@/lib/wallet/review";
import { DeclarationStatusBadge, LineStatusBadge, jstDateTime, yen } from "./wallet-status";

/** 結果の表示 */
export function StatementReviewView({ review }: { review: StatementReview }) {
  const count = (s: string) => review.lines.filter((l) => l.match_status === s).length;
  const needsReview = review.lines.filter((l) => l.match_status === "needs_review");
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="照合済み" value={count("matched")} color="#2F6B47" />
        <Stat label="要確認（記録のない利用など）" value={count("needs_review")} color="#B42318" />
        <Stat label="対象外（手数料など）" value={count("excluded")} color="#6B7280" />
      </div>

      {needsReview.length > 0 && (
        <div className="rounded-lg border p-4" style={{ borderColor: "#F5C2C0", background: "#FDF3F2" }} role="alert">
          <p className="font-bold" style={{ color: "#B42318" }}>
            要確認が {needsReview.length} 件あります
          </p>
          <p className="text-sm">
            iPhone で記録されていない利用、または候補を1件に絞れなかった利用です。施設に確認してください。
          </p>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-lg font-bold">明細の各行</h2>
        <DataTable<ReviewLine>
          rowKey={(r) => r.id}
          data={review.lines}
          columns={[
            { key: "line_no", header: "行" },
            { key: "usage_date", header: "ご利用日", render: (r) => <span className="whitespace-nowrap">{shortDate(r.usage_date)}</span> },
            { key: "card_last4", header: "カード", render: (r) => <span className="whitespace-nowrap">{r.card_last4 ? `…${r.card_last4}` : "—"}</span> },
            { key: "facility_name", header: "施設", render: (r) => r.facility_name ?? (r.card_last4 ? "登録のないカード" : "—") },
            { key: "merchant_name", header: "ご利用店名", render: (r) => r.merchant_name ?? "—" },
            { key: "amount", header: "金額", render: (r) => yen(r.amount) },
            { key: "match_status", header: "結果", render: (r) => <LineStatusBadge status={r.match_status} /> },
            {
              key: "resident_name",
              header: "照合した記録",
              render: (r) => (r.resident_name ? `${r.resident_name} さん（${r.declaration_merchant ?? "店名なし"}）` : "—"),
            },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">明細にまだ現れていない記録</h2>
        <p className="mb-2 text-sm" style={{ color: "var(--qolc-muted)" }}>
          iPhone で記録したが、この明細には含まれていない支払いです。次の明細で現れるのが通常です。締め日を過ぎても現れない場合は確認してください。
        </p>
        <DataTable<ReviewDeclaration>
          rowKey={(r) => r.id}
          data={review.unmatched_declarations}
          emptyMessage="ありません"
          columns={[
            { key: "paid_at", header: "支払い", render: (r) => jstDateTime(r.paid_at) },
            { key: "facility_name", header: "施設", render: (r) => r.facility_name ?? "—" },
            { key: "resident_name", header: "入居者", render: (r) => (r.resident_name ? `${r.resident_name} さん` : "—") },
            { key: "merchant_name", header: "お店", render: (r) => r.merchant_name ?? "—" },
            { key: "amount", header: "金額", render: (r) => yen(r.amount) },
            { key: "status", header: "状態", render: (r) => <DeclarationStatusBadge status={r.status} /> },
          ]}
        />
      </section>
    </div>
  );
}

/** "2026-10-07" → "10/7" */
function shortDate(date: string | null): string {
  if (!date) return "—";
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** 件数のカード */
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--qolc-border)" }}>
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}<span className="ml-1 text-base">件</span></p>
    </div>
  );
}
