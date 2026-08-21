"use client";

/**
 * 施設ポータル: 明細アップロード（施設代行）。
 *
 * 提供者から預かった明細CSV・その他費用CSVを、施設スタッフが提供者に代わって
 * アップロードする画面。対象の提供者（加盟店）を選んでから UploadFlow（提供者
 * ポータルと共通のフロー）に merchantId を渡す。突合はAPI側で自施設の入居者に
 * 限定される（/api/upload の facility_staff 分岐）。
 */
import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { UploadFlow } from "@/components/shared/upload-flow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchFacilityProviders, type LinkedMerchantRow } from "@/lib/portal/relation-queries";

export default function FacilityUploadPage() {
  const [providers, setProviders] = useState<LinkedMerchantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string>("");

  useEffect(() => {
    fetchFacilityProviders()
      .then((rows) => {
        const active = rows.filter((r) => r.status === "active");
        setProviders(active);
        // 提携先が1件だけなら自動選択（選ぶ手間を省く）
        if (active.length === 1) setMerchantId(active[0].id);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "提供者一覧の取得に失敗しました");
        setProviders([]);
      });
  }, []);

  return (
    <PortalLayout portal="facility">
      <Breadcrumb
        items={[
          { label: "ダッシュボード", href: "/facility/dashboard" },
          { label: "明細管理", href: "/facility/statements" },
          { label: "明細アップロード" },
        ]}
      />
      <h1 className="text-2xl font-bold mb-2">明細アップロード</h1>
      <p className="text-sm mb-6" style={{ color: "var(--qolc-muted)" }}>
        提供者から預かった明細CSVを、施設から代わりにアップロードできます。①明細・②その他費用は順不同で同じまとめに合算され、入居者ごとに1決済になります。
      </p>

      {error && (
        <p className="text-sm mb-4" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      {!providers ? (
        <LoadingSpinner label="提携提供者を読み込み中..." />
      ) : providers.length === 0 ? (
        <EmptyState
          title="提携している提供者がいません"
          description="明細のアップロードには提供者（加盟店）との提携が必要です。運営者にお問い合わせください。"
        />
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">対象の提供者</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3" style={{ color: "var(--qolc-muted)" }}>
                どの提供者の明細としてアップロードするかを選んでください。
              </p>
              <select
                aria-label="対象の提供者"
                className="w-full max-w-md rounded border px-3"
                style={{
                  borderColor: "var(--qolc-border)",
                  minHeight: "44px",
                  fontSize: "14px",
                  backgroundColor: "#fff",
                }}
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
              >
                <option value="">提供者を選択してください</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {merchantId ? (
            // key=merchantId: 提供者を切り替えたらまとめ（バッチ）を作り直す
            <UploadFlow key={merchantId} merchantId={merchantId} />
          ) : (
            <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
              提供者を選択するとアップロード枠が表示されます。
            </p>
          )}
        </>
      )}
    </PortalLayout>
  );
}
