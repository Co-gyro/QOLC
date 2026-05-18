"use client";

import { useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { FileUpload } from "@/components/shared/file-upload";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PreviewLine {
  residentName: string | null;
  insuranceNumber: string;
  amount: number;
  matchStatus: "matched" | "unmatched" | "ambiguous";
}

interface PreviewGroup {
  facilityName: string;
  totalAmount: number;
  residents: { name: string; totalAmount: number; lines: PreviewLine[] }[];
  unmatched: PreviewLine[];
}

const MOCK_PREVIEW: PreviewGroup[] = [
  {
    facilityName: "〇〇介護施設",
    totalAmount: 20000,
    residents: [
      { name: "田中太郎", totalAmount: 5000, lines: [{ residentName: "田中太郎", insuranceNumber: "0000001234", amount: 5000, matchStatus: "matched" }] },
      { name: "鈴木花子", totalAmount: 3000, lines: [{ residentName: "鈴木花子", insuranceNumber: "0000005678", amount: 3000, matchStatus: "matched" }] },
      { name: "佐藤次郎", totalAmount: 8000, lines: [{ residentName: "佐藤次郎", insuranceNumber: "0000009999", amount: 8000, matchStatus: "matched" }] },
    ],
    unmatched: [
      { residentName: null, insuranceNumber: "12345678", amount: 6000, matchStatus: "unmatched" },
    ],
  },
];

export default function ProviderUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewGroup[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFile(f: File) {
    setFile(f);
    setLoading(true);
    // モック: 実際は /api/upload を呼ぶ
    await new Promise((r) => setTimeout(r, 600));
    setPreview(MOCK_PREVIEW);
    setLoading(false);
  }

  function executePayment() {
    setConfirming(false);
    setDone(true);
  }

  return (
    <PortalLayout portal="provider">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/provider/dashboard" }, { label: "明細アップロード" }]} />
      <h1 className="text-2xl font-bold mb-6">明細アップロード</h1>

      {!preview && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>CSVファイルを選択</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              onFile={handleFile}
              helperText="自社の明細CSV（被保険者番号を含む）をアップロードしてください。最大10MB。"
            />
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="py-8 flex justify-center">
            <LoadingSpinner size="lg" label={`${file?.name ?? "ファイル"} を処理中...`} />
          </CardContent>
        </Card>
      )}

      {preview && !done && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>プレビュー</CardTitle>
            </CardHeader>
            <CardContent>
              {preview.map((g) => (
                <div key={g.facilityName} className="mb-6 last:mb-0">
                  <h3 className="font-semibold text-lg mb-2">
                    {g.facilityName}
                    <span className="ml-2 text-sm font-normal" style={{ color: "var(--qolc-muted)" }}>
                      （{g.residents.length}名、合計 ¥{g.totalAmount.toLocaleString("ja-JP")}）
                    </span>
                  </h3>
                  <ul className="ml-4 space-y-1">
                    {g.residents.map((r) => (
                      <li key={r.name} className="flex justify-between border-b py-1 text-sm">
                        <span>├ {r.name}</span>
                        <span className="font-medium">¥{r.totalAmount.toLocaleString("ja-JP")}</span>
                      </li>
                    ))}
                    {g.unmatched.map((u, idx) => (
                      <li key={idx} className="flex justify-between border-b py-1 text-sm" style={{ color: "#B45309" }}>
                        <span>
                          ？不明（被保険者番号: {u.insuranceNumber}）
                        </span>
                        <span>
                          ¥{u.amount.toLocaleString("ja-JP")} <StatusBadge status="unmatched" />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="flex gap-2 justify-end">
            <button
              className="qolc-btn px-4 py-2 rounded border"
              style={{ borderColor: "var(--qolc-border)" }}
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
            >
              キャンセル
            </button>
            <button
              className="qolc-btn px-4 py-2 rounded text-white font-medium"
              style={{ backgroundColor: "var(--qolc-primary)" }}
              onClick={() => setConfirming(true)}
            >
              決済を実行
            </button>
          </div>
        </>
      )}

      {done && (
        <Card>
          <CardHeader>
            <CardTitle>決済を実行しました</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
              成功 3件 / 保留 1件（カード未登録）/ 失敗 0件
            </p>
            <a
              href="/provider/dashboard"
              className="qolc-btn inline-block px-4 py-2 rounded text-white"
              style={{ backgroundColor: "var(--qolc-primary)" }}
            >
              ダッシュボードへ戻る
            </a>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirming}
        title="決済を実行しますか？"
        description="この操作はカード登録済みの入居者に対して即座に与信・売上計上を行います。取り消しできません。"
        confirmLabel="実行する"
        cancelLabel="やめる"
        onConfirm={executePayment}
        onCancel={() => setConfirming(false)}
      />
    </PortalLayout>
  );
}
