/**
 * レセプトデータと入居者マスタのマッチングロジック
 *
 * 入力:
 *   - レセプトパーサーの結果（介護保険CSV または 医療保険UKE）
 *   - 入居者一覧（residents テーブルから取得済み）
 *
 * 出力:
 *   - 各レセプトレコードに対し、マッチした入居者 or null + 状態
 *
 * マッチング軸:
 *   - 介護保険: residents.insurance_number と一致
 *     + former_insurance_numbers の type='kaigo' で有効期間内なら fallback
 *   - 医療保険: residents の iryou_hokensha_bangou + iryou_hihokensha_kigou
 *     + iryou_hihokensha_bangou + iryou_hihokensha_edaban の4項目で完全一致
 *     + former_insurance_numbers の type='iryou' で同様にfallback
 *
 * 履歴マッチ:
 *   former_insurance_numbers の各要素は valid_until (yyyy-mm-dd) を持ち、
 *   サービス提供年月の末日が valid_until 以下なら「その月時点で有効」とみなす。
 */
import type { KaigoReceiptResident } from "./kaigo-csv";
import type { IryouReceiptPatient } from "./iryou-uke";

/** マッチング対象となる入居者の最小情報（residents から必要列のみ） */
export interface ResidentForMatching {
  id: string;
  nameLast: string;
  nameFirst: string;
  /** 介護被保険者番号 */
  insuranceNumber: string | null;
  /** 医療保険者番号 */
  iryouHokenshaBangou: string | null;
  /** 医療保険記号 */
  iryouHihokenshaKigou: string | null;
  /** 医療被保険者番号 */
  iryouHihokenshaBangou: string | null;
  /** 医療被保険者番号 枝番 */
  iryouHihokenshaEdaban: string | null;
  /** 過去番号履歴（JSONB配列） */
  formerInsuranceNumbers: FormerInsuranceNumber[];
}

/** former_insurance_numbers の1要素 */
export interface FormerInsuranceNumber {
  type: "kaigo" | "iryou";
  hokensha_bangou?: string | null;
  kigou?: string | null;
  bangou: string;
  edaban?: string | null;
  /** "yyyy-mm-dd" 形式、その日以前のレセプトには有効 */
  valid_until?: string | null;
}

/** マッチング状態 */
export type MatchStatus =
  | "matched" // 現番号で一致
  | "matched_via_history" // 過去番号で一致（履歴マッチ）
  | "unmatched"; // どこにも一致しない

/** 1レセプトレコードのマッチング結果 */
export interface ReceiptMatchResult<T> {
  receipt: T;
  resident: ResidentForMatching | null;
  status: MatchStatus;
  /** 履歴マッチ時、どの履歴要素が一致したか（デバッグ用） */
  matchedHistory?: FormerInsuranceNumber;
}

/**
 * 介護保険レセプトと入居者をマッチングする。
 *
 * @param receipts レセプトパーサーから得た利用者ごとの請求情報
 * @param residents 入居者マスタ（同一施設配下）
 * @returns 各 receipts 要素に対するマッチ結果
 */
export function matchKaigoReceipts(
  receipts: KaigoReceiptResident[],
  residents: ResidentForMatching[]
): ReceiptMatchResult<KaigoReceiptResident>[] {
  return receipts.map((r) => matchOneKaigo(r, residents));
}

function matchOneKaigo(
  r: KaigoReceiptResident,
  residents: ResidentForMatching[]
): ReceiptMatchResult<KaigoReceiptResident> {
  // 1. 現番号で完全一致
  const hit = residents.find(
    (x) => x.insuranceNumber !== null && x.insuranceNumber === r.insuranceNumber
  );
  if (hit) {
    return { receipt: r, resident: hit, status: "matched" };
  }

  // 2. 過去番号(kaigo)で有効期間内マッチ
  for (const resident of residents) {
    const history = (resident.formerInsuranceNumbers ?? []).find(
      (h) =>
        h.type === "kaigo" &&
        h.bangou === r.insuranceNumber &&
        isValidForServiceMonth(h.valid_until, r.serviceMonth)
    );
    if (history) {
      return {
        receipt: r,
        resident,
        status: "matched_via_history",
        matchedHistory: history,
      };
    }
  }

  return { receipt: r, resident: null, status: "unmatched" };
}

/**
 * 医療保険レセプトと入居者をマッチングする。
 *
 * マッチング軸: 保険者番号 + 記号 + 被保険者番号 + 枝番
 * 記号/枝番は保険者により無いケースがあるため、NULL 同士の一致も許容する。
 */
export function matchIryouReceipts(
  receipts: IryouReceiptPatient[],
  residents: ResidentForMatching[]
): ReceiptMatchResult<IryouReceiptPatient>[] {
  return receipts.map((r) => matchOneIryou(r, residents));
}

function matchOneIryou(
  r: IryouReceiptPatient,
  residents: ResidentForMatching[]
): ReceiptMatchResult<IryouReceiptPatient> {
  // 医療保険のマッチング要素はHOレコードから取得。HO が無い (支払基金等で
  // 公費単独のケース) はマッチング不可能と判断（patient.hoken === null）。
  if (!r.hoken) {
    return { receipt: r, resident: null, status: "unmatched" };
  }
  const hoken = r.hoken;

  // 1. 現番号で4項目完全一致
  const hit = residents.find(
    (x) =>
      x.iryouHokenshaBangou === hoken.hokenshaNumber &&
      normalizeNullable(x.iryouHihokenshaKigou) === normalizeNullable(hoken.kigou) &&
      x.iryouHihokenshaBangou === hoken.bangou
    // 枝番は照合しない（保険者により欠落のため）。必要なら厳密化可能。
  );
  if (hit) {
    return { receipt: r, resident: hit, status: "matched" };
  }

  // 2. 過去番号(iryou) で有効期間内マッチ
  for (const resident of residents) {
    const history = (resident.formerInsuranceNumbers ?? []).find(
      (h) =>
        h.type === "iryou" &&
        h.hokensha_bangou === hoken.hokenshaNumber &&
        normalizeNullable(h.kigou) === normalizeNullable(hoken.kigou) &&
        h.bangou === hoken.bangou &&
        isValidForServiceMonth(h.valid_until, r.serviceMonth)
    );
    if (history) {
      return {
        receipt: r,
        resident,
        status: "matched_via_history",
        matchedHistory: history,
      };
    }
  }

  return { receipt: r, resident: null, status: "unmatched" };
}

/**
 * 過去番号の valid_until がサービス提供年月の末日以降なら、その月時点で
 * 有効だったとみなす。
 *
 * @param validUntil "yyyy-mm-dd" 形式
 * @param serviceMonth "yyyymm" 形式
 */
function isValidForServiceMonth(
  validUntil: string | null | undefined,
  serviceMonth: string
): boolean {
  if (!validUntil) return true; // 無期限扱い
  if (!serviceMonth || serviceMonth.length !== 6) return false;
  const year = Number(serviceMonth.slice(0, 4));
  const month = Number(serviceMonth.slice(4, 6));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return false;
  // サービス提供月の月初日を比較（その月のレセプトを発行できるなら、
  // 月初時点でその番号が有効である必要がある）
  const serviceFirstDay = `${serviceMonth.slice(0, 4)}-${serviceMonth.slice(4, 6)}-01`;
  return serviceFirstDay <= validUntil;
}

function normalizeNullable(v: string | null | undefined): string {
  return (v ?? "").trim();
}

/**
 * マッチ結果から金額サマリーを算出する。プレビュー画面で使用。
 */
export interface MatchSummary {
  total: number;
  matched: number;
  matchedViaHistory: number;
  unmatched: number;
  /** 決済対象金額（matched + matched_via_history で本人負担額が>0のもの） */
  totalChargeableAmount: number;
  /** 公費全額負担などで本人負担0のため決済対象外となった件数 */
  zeroBurdenCount: number;
}

export function summarizeKaigoMatches(
  results: ReceiptMatchResult<KaigoReceiptResident>[]
): MatchSummary {
  return summarize(results.map((r) => ({ status: r.status, amount: r.receipt.userBurden })));
}

export function summarizeIryouMatches(
  results: ReceiptMatchResult<IryouReceiptPatient>[]
): MatchSummary {
  return summarize(results.map((r) => ({ status: r.status, amount: r.receipt.userBurden })));
}

function summarize(
  items: { status: MatchStatus; amount: number }[]
): MatchSummary {
  const s: MatchSummary = {
    total: items.length,
    matched: 0,
    matchedViaHistory: 0,
    unmatched: 0,
    totalChargeableAmount: 0,
    zeroBurdenCount: 0,
  };
  for (const it of items) {
    if (it.status === "matched") s.matched += 1;
    else if (it.status === "matched_via_history") s.matchedViaHistory += 1;
    else s.unmatched += 1;
    if (it.status !== "unmatched") {
      if (it.amount > 0) s.totalChargeableAmount += it.amount;
      else s.zeroBurdenCount += 1;
    }
  }
  return s;
}
