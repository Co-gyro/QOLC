"use client";

/**
 * USEN連携用CSVセクション（加盟店申請の登録手続き内）
 *
 * 審査結果（SAISON/JCB加盟店番号）が揃ったら、加盟店マスタ登録CSV
 * （Shift-JIS・実送付ファイル準拠）を生成してダウンロードする。
 * 不足があれば「何を先に済ませるべきか」を表示する。
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  buildUsenMasterCsv,
  buildUsenFilename,
  toSjisBytes,
  validateUsenMaster,
  type UsenMasterInput,
} from "@/lib/merchant-application/usen-master";
import { parseUdInput } from "@/lib/applications/ud-input";
import { getJstDateParts } from "@/lib/workflow/utils";
import type { ApplicationDetail } from "@/lib/applications/types";

export interface UsenCsvSectionProps {
  detail: ApplicationDetail;
}

/** 案件データから生成入力を組み立てる（不足は undefined のまま） */
function buildInput(detail: ApplicationDetail): Partial<UsenMasterInput> {
  const { fields, review, codes } = parseUdInput(detail.udInput ?? null);
  const payload = (detail.payload ?? {}) as Record<string, unknown>;
  const facilityName =
    typeof payload.facilityName === "string" && payload.facilityName.trim() !== ""
      ? payload.facilityName
      : (detail.applicantOrg ?? undefined);
  return {
    mallCode: codes?.mall_code,
    terminalId: codes?.terminal_id,
    salesName: fields.tenant_name_latin,
    receiptName: facilityName,
    saisonMerchantCode: review.saison?.merchant_code ?? undefined,
    jcbMerchantCode: review.jcb?.merchant_code_recurring ?? undefined,
  };
}

export function UsenCsvSection({ detail }: UsenCsvSectionProps) {
  const input = useMemo(() => buildInput(detail), [detail]);
  const errors = useMemo(() => validateUsenMaster(input), [input]);

  function handleDownload() {
    if (errors.length > 0) return;
    const csv = buildUsenMasterCsv(input as UsenMasterInput);
    const bytes = toSjisBytes(csv);
    const blob = new Blob([bytes], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildUsenFilename(input.receiptName ?? "加盟店", getJstDateParts());
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        審査結果が揃ったら、USENの加盟店マスタ登録CSV（Shift-JIS）を生成できます。
        採番値・店舗名アルファベット・SAISON/JCB加盟店番号から自動で作られます（手入力なし）。
      </p>
      {errors.length > 0 ? (
        <ul className="text-sm list-disc pl-5" style={{ color: "#B45309" }}>
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : (
        <div>
          <Button
            type="button"
            onClick={handleDownload}
            style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
          >
            USEN連携用CSVをダウンロード
          </Button>
        </div>
      )}
      <div
        className="text-sm border rounded-md px-4 py-3"
        style={{ borderColor: "var(--qolc-border)", color: "var(--qolc-muted)" }}
      >
        <p className="font-medium" style={{ color: "var(--qolc-text)" }}>
          USENへの連携手順（運用ルール）
        </p>
        <ol className="list-decimal pl-5 mt-1">
          <li>ダウンロードしたCSVを USEN 共有の Google Drive に格納する</li>
          <li>格納したら必ず USEN 担当（古賀さん）へメールで連絡する（アップだけでは処理されません）</li>
          <li>当日15時までの依頼は当日処理、15時以降は翌営業日処理</li>
        </ol>
      </div>
    </div>
  );
}
