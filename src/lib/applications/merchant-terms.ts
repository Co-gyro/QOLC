/**
 * 加盟店規約への同意（純データ＋純関数）
 *
 * UD はカード会社の包括加盟店であり、新規申込店舗の審査は当社が行う建付け。
 * そのため申込時に、お客様（子加盟店）が各カード会社の加盟店規約に同意した
 * 事実を証跡として残す必要がある。
 *
 * 記録は「同意日時」と「そのとき提示していた規約の名称・URL」をセットで持つ。
 * 規約は改定されるため、URL だけでは後から「何に同意したのか」を示せない。
 */

/** 規約の発行元。ud=当社（UD）の加盟店規約・申込規定 */
export type TermsIssuer = "saison" | "jcb" | "ud";

/** 同意対象の規約1件 */
export interface MerchantTermsDocument {
  issuer: TermsIssuer;
  /** 画面・記録に出す正式名称 */
  title: string;
  /** 規約の掲載URL（別タブで開く） */
  url: string;
}

/**
 * 申込画面で提示し、同意の対象とする規約の一覧。
 *
 * 表示・保存・管理画面の表示すべてがこの定義を参照するため、
 * 規約を追加・変更するときはここだけを直せばよい。
 *
 * TODO(UD規約): 当社の加盟店規約／申込規定の掲載URLが決まったら、
 * 次の1行を有効にする（フォームの表示・payload への記録が自動で追従する）。
 *   { issuer: "ud", title: "ユニバーサル・デベロップメント加盟店規約", url: "https://uni-dev.jp/..." },
 */
export const MERCHANT_TERMS_DOCUMENTS: readonly MerchantTermsDocument[] = [
  {
    issuer: "saison",
    title: "クレディセゾン加盟店規約",
    url: "https://www.saisoncard.co.jp/pdf/kameiten_01.pdf",
  },
  {
    issuer: "jcb",
    title: "JCB加盟店規約",
    url: "https://www.jcb.co.jp/merchant/regulation/index.html",
  },
];

/** payload に保存する同意の記録 */
export interface TermsAgreementRecord {
  /** 同意済みであること（未同意の申込は受け付けない） */
  agreed: true;
  /** 同意日時（ISO8601・サーバー時刻） */
  agreedAt: string;
  /** 同意時点で提示していた規約の一覧 */
  documents: MerchantTermsDocument[];
}

/**
 * 同意の記録を組み立てる。
 *
 * 日時と規約一覧はクライアントから受け取った値を使わず、必ずサーバー側で
 * 確定させる（申込者の端末時刻や改変された値を証跡にしないため）。
 * @param agreedAt 同意日時（ISO8601。API Route でサーバー時刻を渡す）
 */
export function buildTermsAgreementRecord(agreedAt: string): TermsAgreementRecord {
  return {
    agreed: true,
    agreedAt,
    documents: [...MERCHANT_TERMS_DOCUMENTS],
  };
}

/**
 * 保存済みの同意記録を管理画面の1行表示に整形する。
 * 記録が無い・壊れている場合は null（区分導入前の申請など）。
 * @param value payload.termsAgreement
 */
export function formatTermsAgreement(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<TermsAgreementRecord>;
  if (v.agreed !== true || typeof v.agreedAt !== "string") return null;
  const d = new Date(v.agreedAt);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const titles = Array.isArray(v.documents)
    ? v.documents.map((doc) => doc.title).filter((t) => typeof t === "string")
    : [];
  return titles.length > 0 ? `${stamp} 同意（${titles.join("・")}）` : `${stamp} 同意`;
}
