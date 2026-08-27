/**
 * 加盟店申請の「申請区分」定義（純データ＋純関数）
 *
 * 背景: 加盟店申請フォームは元々 QOLC（介護施設向け）専用の文言だったが、
 * 介護以外の事業者からの申請が入るようになり「介護」「施設」という語に
 * 違和感を持たれるようになった。区分ごとに文言だけを差し替え、
 * payload のキー（facilityName など）は共通のまま保つことで、
 * 下流の申請書生成（JCB / セゾン / USEN）を一切変更せずに済ませる。
 *
 * DB の application_source ENUM は増やさない（DDL 不要）。区分は
 * payload.applyType に保持し、admin 側はそれを見て表示を切り替える。
 */

/** 申請区分。care=介護施設向け（QOLC）/ general=一般の店舗・事業所向け */
export type MerchantApplyType = "care" | "general";

/** 全区分（表示順） */
export const MERCHANT_APPLY_TYPES: readonly MerchantApplyType[] = [
  "care",
  "general",
];

/**
 * 区分未指定（applyType 追加前に受け付けた申請）の既定値。
 * 既存データはすべて介護施設向けとして受け付けたものなので care とする。
 */
export const DEFAULT_APPLY_TYPE: MerchantApplyType = "care";

/** 区分ごとの表示文言一式（フォーム・入口カード・admin バッジ） */
export interface ApplyTypeCopy {
  key: MerchantApplyType;
  /** 入口カードの絵文字アイコン */
  icon: string;
  /** 入口カード / タブの見出し */
  title: string;
  /** 入口カードの1行説明 */
  tagline: string;
  /** 入口カードの対象例 */
  examples: string;
  /** フォーム冒頭の見出し */
  heroTitle: string;
  /** フォーム冒頭のリード文 */
  heroLead: string;
  /** 「施設」に相当する呼称（セクション見出し・各ラベルの語幹） */
  siteNoun: string;
  /** 屋号欄のプレースホルダ */
  siteNamePlaceholder: string;
  /** 屋号フリガナ欄のプレースホルダ */
  siteNameKanaPlaceholder: string;
  /** 法人名欄のプレースホルダ */
  corpNamePlaceholder: string;
  /** 法人名フリガナ欄のプレースホルダ */
  corpNameKanaPlaceholder: string;
  /** 備考欄のプレースホルダ */
  notePlaceholder: string;
  /** 申請フローの説明文（フォーム上部） */
  flowLead: string;
  /** 手続きを代行する主体の呼び方（フロー説明・完了画面で使う） */
  agentName: string;
  /** admin 一覧・詳細に出す区分バッジの文言 */
  badge: string;
  /** admin 区分バッジの配色 */
  badgeColor: { bg: string; fg: string };
}

/**
 * 区分ごとの文言。
 * general 側からは「介護」「施設」という語を一切出さない
 * （介護以外のお客様が申請する入口のため）。
 */
export const APPLY_TYPE_COPY: Record<MerchantApplyType, ApplyTypeCopy> = {
  care: {
    key: "care",
    icon: "🏠",
    title: "介護施設向け（QOLC）",
    tagline: "入居者の自己負担分をカードで自動決済するQOLCをご利用の方",
    examples: "有料老人ホーム・サービス付き高齢者向け住宅・グループホーム など",
    heroTitle: "加盟店申請（介護施設向け）",
    heroLead:
      "QOLCのカード決済サービスをご利用いただくための加盟店登録のお申し込みフォームです。",
    siteNoun: "施設",
    siteNamePlaceholder: "例：サンプルケア有料老人ホーム東京",
    siteNameKanaPlaceholder: "例：サンプルケアユウリョウロウジンホームトウキョウ",
    corpNamePlaceholder: "例：株式会社サンプルケア",
    corpNameKanaPlaceholder: "例：カブシキガイシャサンプルケア",
    notePlaceholder: "施設の入居者数、利用予定のサービス、ご質問など",
    flowLead:
      "まずはこちらのフォームで基本情報をお送りください。フォーム送信後、担当スタッフがお電話またはメールにて詳しい内容を聞き取りさせていただきます。ヒアリングの内容をもとに、私たちがカード会社（JCB・セゾン）への正式な申請書類を作成・提出いたしますので、難しい書類作業はございません。",
    agentName: "QOLC",
    badge: "介護施設向け",
    badgeColor: { bg: "#E6F4EA", fg: "#1B5E20" },
  },
  general: {
    key: "general",
    icon: "🏪",
    title: "一般の店舗・事業所向け",
    tagline: "業種を問わず、クレジットカード決済を導入したい事業者の方",
    examples: "飲食・小売・サービス業・専門サービス・EC など",
    heroTitle: "加盟店申請",
    heroLead:
      "クレジットカード決済をご利用いただくための加盟店登録のお申し込みフォームです。業種は問いません。",
    siteNoun: "店舗・事業所",
    siteNamePlaceholder: "例：サンプルストア東京店",
    siteNameKanaPlaceholder: "例：サンプルストアトウキョウテン",
    corpNamePlaceholder: "例：株式会社サンプル",
    corpNameKanaPlaceholder: "例：カブシキガイシャサンプル",
    notePlaceholder: "取扱商材・サービス内容、想定の月間売上、ご質問など",
    flowLead:
      "まずはこちらのフォームで基本情報をお送りください。フォーム送信後、担当スタッフがお電話またはメールにて詳しい内容を聞き取りさせていただきます。ヒアリングの内容をもとに、私たちがカード会社（JCB・セゾン）への正式な申請書類を作成・提出いたしますので、難しい書類作業はございません。",
    agentName: "当社",
    badge: "一般加盟店",
    badgeColor: { bg: "#EEF2FF", fg: "#3730A3" },
  },
};

/**
 * 任意の値を申請区分として解釈する（不正値・未指定は既定値）。
 * URL クエリ（?type=general）と payload の双方から使う。
 * @param value 判定対象
 */
export function parseApplyType(value: unknown): MerchantApplyType {
  return value === "general" || value === "care" ? value : DEFAULT_APPLY_TYPE;
}

/**
 * 値が明示的な申請区分かどうか（未指定と「既定値へのフォールバック」を区別する）。
 * 入口の選択画面を出すか、フォームを直接出すかの判定に使う。
 * @param value 判定対象
 */
export function isApplyType(value: unknown): value is MerchantApplyType {
  return value === "general" || value === "care";
}

/**
 * 申請 payload から区分を取り出す。
 * applyType 追加前の既存申請は未設定なので care 扱いになる。
 * @param payload applications.payload
 */
export function applyTypeOfPayload(
  payload: Record<string, unknown> | null | undefined
): MerchantApplyType {
  return parseApplyType(payload?.applyType);
}

/**
 * 区分に応じた「屋号」系ラベルを組み立てる。
 * 介護=「施設名」、一般=「店舗・事業所名」のように語幹だけを差し替える。
 * @param type 申請区分
 */
export function applySiteLabels(type: MerchantApplyType): {
  section: string;
  name: string;
  nameKana: string;
  postalCode: string;
  address: string;
  phone: string;
} {
  const n = APPLY_TYPE_COPY[type].siteNoun;
  return {
    section: `${n}情報`,
    name: `${n}名`,
    nameKana: `${n}名フリガナ`,
    postalCode: `${n} 郵便番号`,
    address: `${n} 所在地`,
    phone: `${n} 電話番号`,
  };
}
