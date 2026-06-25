/**
 * 利用料請求書兼領収書 モデル（純粋ロジック層）
 *
 * 実サンプル（参考フォルダ「レセプト」内 Type B 各種）に準拠した
 * 「利用料請求書兼領収書」を組み立てるためのデータモデルとケース判定。
 *
 * 設計方針:
 *   - QOLCは金額を独自計算しない。レセプト/請求ソフトの確定額を直読する（星さん方針）。
 *   - 表示ロジック（ラベル・行構成・税・脚注）はサービス分類で分岐する。
 *   - 描画（@react-pdf）から切り離し、ここを単体テスト対象にする。
 *
 * 3つのケース:
 *   - kaigo（介護保険）: 「費用総額(保険内)」「介護保険給付額」、消費税なし
 *   - iryou（医療保険）: 「費用総額」「医療保険給付額」、消費税なし、10円未満四捨五入の脚注
 *   - jihi （住宅・自費）: 「その他費用」のみ、給付なし、軽減税率（10%/8%）対応
 */

/** サービス分類（請求書の表示ロジックを決定する） */
export type ReceiptCategory = "kaigo" | "iryou" | "jihi";

/** 消費税の税率バケット（自費請求のみ非ゼロ） */
export interface ReceiptTaxBucket {
  /** 対象額（税込） */
  amount: number;
  /** うち消費税 */
  tax: number;
}

/** サービス提供者情報（請求書右下のボックス） */
export interface ReceiptProvider {
  name: string;
  postalCode?: string;
  address?: string;
  tel?: string;
}

/** 請求書兼領収書の入力（呼び出し側がレセプト確定値を渡す） */
export interface ReceiptInput {
  /** サービス分類 */
  category: ReceiptCategory;
  /** 帳票番号（No.xxxx）。任意 */
  documentNo?: string;
  /** 発行日（表示文字列。例: 令和8年6月3日 / 2026/06/03） */
  issuedAt: string;
  /** 請求年月（表示文字列。例: 令和8年5月） */
  billingMonth: string;

  /** 宛名（大きく表示。例: 渡邉 愛） */
  recipientName: string;
  /** 〒（任意） */
  recipientPostalCode?: string;
  /** 住所（任意） */
  recipientAddress?: string;
  /** 「ご利用者: ○○ 様分」。請求名義と利用者本人が別のとき表示（任意） */
  userLabel?: string;

  /** 本人請求額＝御請求/領収金額（税込）。カード決済の対象額 */
  userBurden: number;
  /** 費用総額（保険系のみ）。未指定かつ給付額があれば userBurden+給付額で導出 */
  costTotal?: number;
  /** 保険給付額（保険系のみ・▲表示）。未指定かつ費用総額があれば 費用総額-userBurden で導出 */
  insuranceBenefit?: number;

  /** 明細1行目の項目名を上書き（未指定はカテゴリ既定） */
  serviceItemLabel?: string;
  /** 費用総額行ラベルを上書き（未指定はカテゴリ既定） */
  costTotalLabel?: string;
  /** 給付額行ラベルを上書き（未指定はカテゴリ既定） */
  benefitLabel?: string;

  /** 10%対象（自費のみ）。未指定は 0円/0円 */
  tax10?: ReceiptTaxBucket;
  /** 8%対象☆（軽減税率・自費のみ）。未指定は 0円/0円 */
  tax8?: ReceiptTaxBucket;

  /** 提供者情報 */
  provider: ReceiptProvider;

  /**
   * カード決済情報。QOLCは全件クレジットカード決済のため既定でカード表記になる。
   * brand/settledAt は任意（あれば表示）。
   */
  payment?: ReceiptPayment;

  /**
   * 適格請求書（インボイス）発行事業者の登録番号（T+13桁）。発行者＝提供者の番号。
   * 設定時のみ表示。自費の課税分でインボイス対応する場合に使う。
   */
  invoiceRegistrationNumber?: string;

  /**
   * 集金代行（代理受領）者名。QOLCはUD/QOLCがUSEN経由でカード集金する代理受領のため
   * 既定でUDを表示。null を渡すと非表示、文字列で上書き可。
   */
  collectionAgent?: string | null;

  /** 脚注を上書き（未指定は医療カテゴリのみ既定の四捨五入注記が入る） */
  footnote?: string;
}

/** カード決済情報 */
export interface ReceiptPayment {
  /** カードブランド（VISA / Mastercard / JCB 等）。任意 */
  brand?: string;
  /** 決済日（表示文字列）。任意 */
  settledAt?: string;
  /**
   * 収入印紙不要の注記を出すか。クレジットカード決済は信用取引で金銭の直接受領が
   * ないため、利用明記により印紙税は非課税（国税庁見解）。既定 true。
   */
  showStampDutyNote?: boolean;
}

/** 明細テーブルの1行（項目名 / 内訳 / 金額） */
export interface ReceiptItemRow {
  /** 項目名（左列） */
  itemName: string;
  /** 内訳（中央列・費用総額/給付額の金額。▲付きあり）。null は空欄 */
  breakdown: string | null;
  /** 金額（右列・本人請求額）。null は空欄 */
  amount: string | null;
}

/** 描画用に解決済みのモデル */
export interface ReceiptModel {
  category: ReceiptCategory;
  documentNo: string | null;
  issuedAt: string;
  billingMonth: string;
  recipientName: string;
  recipientPostalCode: string | null;
  recipientAddress: string | null;
  userLabel: string | null;
  /** 領収金額（税込）の数値表示（単位なし。描画側で「 円」を付す）。例: 15,191 */
  amountDisplay: string;
  /** 明細テーブル行（保険系=3行 / 自費=1行） */
  itemRows: ReceiptItemRow[];
  tax10: ReceiptTaxBucket;
  tax8: ReceiptTaxBucket;
  provider: ReceiptProvider;
  footnote: string | null;
  /** 軽減税率の注記（☆）を表示するか */
  showReducedTaxNote: boolean;
  /** 受領文言（カード決済なら「クレジットカードにて領収」） */
  receivedStatement: string;
  /** お支払方法の表示（例: クレジットカード（VISA）　決済日：令和8年6月3日）。null は非表示 */
  paymentLine: string | null;
  /** 収入印紙不要の注記。null は非表示 */
  stampDutyNote: string | null;
  /** インボイス登録番号（T+13桁）。null は非表示 */
  invoiceRegistrationNumber: string | null;
  /** 集金代行（代理受領）の明記。null は非表示 */
  agentLine: string | null;
}

/** 3桁区切りの数値文字列（単位なし・小数切り捨て）。例: 15,191 */
export function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString("ja-JP");
}

/** 円整数を「1,234円」表記に（小数は切り捨て・サンプル準拠で¥は使わない） */
export function formatYen(n: number): string {
  return `${formatNumber(n)}円`;
}

/** ▲付き（給付額の控除表示）。例: ▲136,713円 */
export function formatBenefit(n: number): string {
  return `▲${formatNumber(Math.abs(n))}円`;
}

const ZERO_TAX: ReceiptTaxBucket = { amount: 0, tax: 0 };

/** 既定の集金代行（代理受領）者。運営=ユニバーサルデベロップメント株式会社 */
const DEFAULT_COLLECTION_AGENT = "ユニバーサルデベロップメント株式会社（QOLC）";

/** カテゴリ既定のラベル */
const CATEGORY_DEFAULTS: Record<
  ReceiptCategory,
  { costTotalLabel: string; benefitLabel: string; serviceItemPrefix: string; footnote: string | null }
> = {
  kaigo: {
    costTotalLabel: "費用総額(保険内)",
    benefitLabel: "介護保険給付額",
    serviceItemPrefix: "保険内サービス",
    footnote: null,
  },
  iryou: {
    costTotalLabel: "費用総額",
    benefitLabel: "医療保険給付額",
    serviceItemPrefix: "保険内サービス",
    footnote:
      "利用者負担額(医療分)の10円未満の端数が四捨五入されるため、内訳の合計と合計金額が異なる場合がございます。",
  },
  jihi: {
    costTotalLabel: "費用総額",
    benefitLabel: "",
    serviceItemPrefix: "その他費用",
    footnote: null,
  },
};

/**
 * 入力を描画用モデルへ解決する。
 *
 * - 保険系（kaigo/iryou）: 「項目（本人請求）/費用総額（内訳）/給付額（▲内訳）」の3行。
 *   費用総額・給付額のどちらか一方のみ与えられた場合は他方を導出する。
 * - 自費（jihi）: 「その他費用（本人請求）」の1行。費用総額/給付額は出さない。
 *
 * @throws 保険系で費用総額・給付額がともに未指定、または整合しない場合
 */
export function buildReceiptModel(input: ReceiptInput): ReceiptModel {
  if (!Number.isFinite(input.userBurden) || input.userBurden < 0) {
    throw new Error("userBurden は0以上の数値である必要があります");
  }
  const defaults = CATEGORY_DEFAULTS[input.category];
  const serviceItemLabel =
    input.serviceItemLabel ??
    (input.category === "jihi"
      ? defaults.serviceItemPrefix
      : `${defaults.serviceItemPrefix}(${input.billingMonth})`);

  const itemRows: ReceiptItemRow[] = [];

  if (input.category === "jihi") {
    // 自費: 給付控除なし。本人請求額をそのまま1行で。
    itemRows.push({
      itemName: serviceItemLabel,
      breakdown: null,
      amount: formatYen(input.userBurden),
    });
  } else {
    // 保険系: 費用総額・給付額を解決（一方からもう一方を導出）
    const { costTotal, benefit } = resolveInsuranceAmounts(input);
    itemRows.push({
      itemName: serviceItemLabel,
      breakdown: null,
      amount: formatYen(input.userBurden),
    });
    itemRows.push({
      itemName: `　${input.costTotalLabel ?? defaults.costTotalLabel}`,
      breakdown: formatYen(costTotal),
      amount: null,
    });
    itemRows.push({
      itemName: `　${input.benefitLabel ?? defaults.benefitLabel}`,
      breakdown: formatBenefit(benefit),
      amount: null,
    });
  }

  const tax10 = input.tax10 ?? ZERO_TAX;
  const tax8 = input.tax8 ?? ZERO_TAX;
  const card = resolveCardPayment(input.payment);

  return {
    category: input.category,
    documentNo: input.documentNo ?? null,
    issuedAt: input.issuedAt,
    billingMonth: input.billingMonth,
    recipientName: input.recipientName,
    recipientPostalCode: input.recipientPostalCode ?? null,
    recipientAddress: input.recipientAddress ?? null,
    userLabel: input.userLabel ?? null,
    amountDisplay: formatNumber(input.userBurden),
    itemRows,
    tax10,
    tax8,
    provider: input.provider,
    footnote: input.footnote ?? defaults.footnote,
    showReducedTaxNote: true,
    receivedStatement: card.receivedStatement,
    paymentLine: card.paymentLine,
    stampDutyNote: card.stampDutyNote,
    invoiceRegistrationNumber: input.invoiceRegistrationNumber ?? null,
    agentLine: resolveAgentLine(input.collectionAgent),
  };
}

/**
 * 集金代行（代理受領）の明記行を解決する。
 * provider を領収者（発行者）としつつ、UD/QOLCが代理受領した旨を明記する。
 */
function resolveAgentLine(collectionAgent?: string | null): string | null {
  if (collectionAgent === null) return null; // 明示的に非表示
  const agent = collectionAgent === undefined ? DEFAULT_COLLECTION_AGENT : collectionAgent;
  if (!agent) return null;
  return `上記金額は ${agent} が提供者に代わり集金代行（クレジットカード決済）により代理受領しています。`;
}

/**
 * カード決済の表示要素を解決する。
 * QOLCは全件クレジットカード決済のため、payment未指定でもカード表記を既定とする。
 */
function resolveCardPayment(payment?: ReceiptPayment): {
  receivedStatement: string;
  paymentLine: string;
  stampDutyNote: string | null;
} {
  const methodLabel = payment?.brand
    ? `クレジットカード（${payment.brand}）`
    : "クレジットカード";
  const paymentLine = payment?.settledAt
    ? `お支払方法：${methodLabel}　決済日：${payment.settledAt}`
    : `お支払方法：${methodLabel}`;
  const showStamp = payment?.showStampDutyNote ?? true;
  return {
    receivedStatement: "上記金額をクレジットカードにて領収いたしました",
    paymentLine,
    stampDutyNote: showStamp
      ? "クレジットカード決済のため、収入印紙は不要です。"
      : null,
  };
}

/**
 * 保険系の費用総額・給付額を解決する。
 * 関係式: 費用総額 = 給付額 + 本人請求額（本人請求額=userBurden）。
 * 医療保険は10円未満四捨五入により厳密一致しない場合があるため、整合チェックは
 * 介護（端数なし）のみ厳格に行い、医療は許容する。
 */
function resolveInsuranceAmounts(input: ReceiptInput): {
  costTotal: number;
  benefit: number;
} {
  let { costTotal, insuranceBenefit: benefit } = input;

  if (costTotal == null && benefit == null) {
    throw new Error(
      "保険系の請求書には費用総額または給付額のいずれかが必要です"
    );
  }
  if (costTotal == null && benefit != null) {
    costTotal = benefit + input.userBurden;
  }
  if (benefit == null && costTotal != null) {
    benefit = costTotal - input.userBurden;
  }
  // ここで両方とも数値
  const ct = costTotal as number;
  const bf = benefit as number;
  if (bf < 0) {
    throw new Error("給付額が負になりました（費用総額 < 本人請求額）");
  }
  if (input.category === "kaigo") {
    // 介護は端数処理なし → 厳密一致を要求
    if (ct !== bf + input.userBurden) {
      throw new Error(
        `費用総額(${ct}) が 給付額(${bf})+本人請求(${input.userBurden}) と一致しません`
      );
    }
  }
  return { costTotal: ct, benefit: bf };
}
