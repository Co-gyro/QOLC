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

/**
 * 一覧の「いま何を待っているか」表示（単一リスト用）。
 * ステータスを手で更新させず、作業の進み具合から自動で導出した文言を出す。
 */
export const MERCHANT_STAGE_WAITING: Record<MerchantStage, string> = {
  new: "記載内容の確認から",
  ud_working: "採番・UD補足・申請書の作成",
  under_review: "審査結果の到着待ち",
  result_processing: "登録処理（加盟店・アカウント）",
  closed: "完了・却下",
};

/** 「いま何を待っているか」ピルの配色（実務フローの温度感に合わせる） */
export const MERCHANT_STAGE_COLORS: Record<MerchantStage, { bg: string; fg: string }> = {
  new: { bg: "#FCF1E3", fg: "#B45309" },
  ud_working: { bg: "#E0F2FE", fg: "#0369A1" },
  under_review: { bg: "#FAE8FF", fg: "#86198F" },
  result_processing: { bg: "#E6F4EA", fg: "#1B5E20" },
  closed: { bg: "#F3F4F6", fg: "#4B5563" },
};

/**
 * 単一リストの並び順: 実務フロー順（新規→UD対応→審査→登録処理→完了）、
 * 同一ステージ内は受付日の古い順（先に来たものから対応する）。
 */
export function compareByMerchantStage(a: ApplicationRow, b: ApplicationRow): number {
  const sa = MERCHANT_STAGE_ORDER.indexOf(deriveMerchantStage(a));
  const sb = MERCHANT_STAGE_ORDER.indexOf(deriveMerchantStage(b));
  if (sa !== sb) return sa - sb;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}
