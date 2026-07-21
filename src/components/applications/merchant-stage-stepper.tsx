"use client";

/**
 * 加盟店申請の進捗ステッパー（作業ページ上部・見るだけ）
 *
 * ステージは作業の進み具合（merchant-stage.ts）から自動導出し、操作はさせない。
 * 「業務をすると進捗が勝手に進む」を可視化する部品。
 */
import {
  deriveMerchantStage,
  MERCHANT_STAGE_ORDER,
  MERCHANT_STAGE_LABELS,
} from "@/lib/applications/merchant-stage";
import type { ApplicationRow } from "@/lib/applications/types";

export interface MerchantStageStepperProps {
  row: Pick<ApplicationRow, "status" | "udInput" | "merchantId">;
}

export function MerchantStageStepper({ row }: MerchantStageStepperProps) {
  const current = deriveMerchantStage(row);
  const currentIdx = MERCHANT_STAGE_ORDER.indexOf(current);
  return (
    <ol
      className="flex flex-wrap rounded-lg border overflow-hidden mb-5"
      style={{ borderColor: "var(--qolc-border)" }}
      aria-label="申請の進捗（自動更新・操作不要）"
    >
      {MERCHANT_STAGE_ORDER.map((stage, i) => {
        const done = i < currentIdx;
        const now = i === currentIdx;
        return (
          <li
            key={stage}
            aria-current={now ? "step" : undefined}
            className="flex-1 min-w-[110px] px-3 py-2 text-sm text-center border-l first:border-l-0 whitespace-nowrap"
            style={{
              borderColor: "var(--qolc-border)",
              backgroundColor: done ? "var(--qolc-bg-soft)" : now ? "#FCF1E3" : "transparent",
              color: done ? "var(--qolc-primary)" : now ? "#B45309" : "var(--qolc-muted)",
              fontWeight: now ? 700 : done ? 600 : 400,
            }}
          >
            {done ? "✓ " : ""}
            {MERCHANT_STAGE_LABELS[stage].title}
          </li>
        );
      })}
    </ol>
  );
}
