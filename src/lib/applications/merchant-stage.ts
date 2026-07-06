/**
 * 加盟店申請のステージ判定（純ロジック）
 *
 * 「お客様入力の保存」→「UD対応」→「カード会社へ審査提出」→「結果受領・登録処理」→「完了」
 * という実務フローのどこにいるかを、applications の status / ud_input.review /
 * merchant_id から導出する。申請・相談ページの加盟店申請タブでステージ別リスト表示に使う。
 */
import { parseUdInput } from "@/lib/applications/ud-input";
import type { ApplicationRow } from "@/lib/applications/types";

/** 加盟店申請のステージ（実務フロー順） */
export type MerchantStage =
  | "new" // 新規受付: お客様入力が保存され、まだ誰も着手していない
  | "ud_working" // UD対応中: 内容確認・UD追記・申請書作成（審査未提出）
  | "under_review" // 審査提出中: カード会社に提出済みで結果待ちが残っている
  | "result_processing" // 結果受領: 全社の結果が揃い、加盟店/施設登録・USEN/セルフィッシュ入力へ
  | "closed"; // 完了・却下

/** ステージの表示順 */
export const MERCHANT_STAGE_ORDER: readonly MerchantStage[] = [
  "new",
  "ud_working",
  "under_review",
  "result_processing",
  "closed",
];

/** ステージの見出しと説明（ステージ別リストのセクションヘッダ用） */
export const MERCHANT_STAGE_LABELS: Record<MerchantStage, { title: string; description: string }> =
  {
    new: {
      title: "新規受付",
      description: "お客様が入力した申請が保存された状態です。内容を確認して担当者を決めてください。",
    },
    ud_working: {
      title: "UD対応中",
      description: "内容確認・UD追記情報の入力・申請書の作成を行い、カード会社へ提出します。",
    },
    under_review: {
      title: "審査提出中（結果待ち）",
      description: "カード会社へ審査を提出済みです。結果が届いたら審査結果を登録してください。",
    },
    result_processing: {
      title: "結果受領・登録処理",
      description: "審査結果が揃いました。加盟店・施設の登録と、USEN／セルフィッシュへの情報入力を進めてください。",
    },
    closed: {
      title: "完了・却下",
      description: "登録まで完了した申請、または審査却下となった申請です。",
    },
  };

/**
 * 申請1件のステージを導出する。
 * - done / rejected → closed
 * - new → new
 * - 対応中/相手待ち: 審査提出が1社もなければ ud_working、
 *   提出済みで結果未確定の会社が残っていれば under_review、
 *   提出済みの全社の結果が確定していれば result_processing
 */
export function deriveMerchantStage(
  row: Pick<ApplicationRow, "status" | "udInput" | "merchantId">
): MerchantStage {
  if (row.status === "done" || row.status === "rejected") return "closed";
  if (row.status === "new") return "new";
  const { review } = parseUdInput(row.udInput ?? null);
  const companies = [review.jcb, review.saison].filter(
    (c): c is NonNullable<typeof c> => c != null
  );
  const submitted = companies.filter((c) => !!c.submitted_at);
  if (submitted.length === 0) return "ud_working";
  const waitingResult = submitted.some((c) => !c.result);
  return waitingResult ? "under_review" : "result_processing";
}

/** ステージ別にグルーピングする（順序は MERCHANT_STAGE_ORDER に従う） */
export function groupByMerchantStage(rows: ApplicationRow[]): Map<MerchantStage, ApplicationRow[]> {
  const map = new Map<MerchantStage, ApplicationRow[]>();
  for (const stage of MERCHANT_STAGE_ORDER) map.set(stage, []);
  for (const r of rows) {
    map.get(deriveMerchantStage(r))?.push(r);
  }
  return map;
}
