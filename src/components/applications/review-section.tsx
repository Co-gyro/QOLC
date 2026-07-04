/**
 * 審査結果セクション（source=qolc_merchant のみ）
 *
 * JCB / セゾンそれぞれの審査結果フォームと、審査通過後のアクション
 * （審査通過メール送信・加盟店として登録）をまとめる。
 */
"use client";

import { ReviewCompanyForm } from "./review-company-form";
import { ConvertActions } from "./convert-actions";
import { parseUdInput, summarizeReview } from "@/lib/applications/ud-input";
import type { ApplicationDetail } from "@/lib/applications/types";

export interface ReviewSectionProps {
  detail: ApplicationDetail;
  /** 保存・変換成功後に詳細を再読込させる */
  onSaved: () => void;
}

export function ReviewSection({ detail, onSaved }: ReviewSectionProps) {
  const { review } = parseUdInput(detail.udInput ?? null);
  const summary = summarizeReview(review);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        JCB・セゾンから届いた審査結果を登録します。結果を「通過」で保存すると、
        審査通過メールの送信と加盟店登録へ進めます。
      </p>
      <ReviewCompanyForm
        applicationId={detail.id}
        company="jcb"
        current={review.jcb}
        onSaved={onSaved}
      />
      <ReviewCompanyForm
        applicationId={detail.id}
        company="saison"
        current={review.saison}
        onSaved={onSaved}
      />
      <ConvertActions detail={detail} summary={summary} onDone={onSaved} />
    </div>
  );
}
