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

  /**
   * サービス利用明細（明細書ページ用）。1件以上あると2ページ目に明細書を出力する。
   * QOLCの実データでは statement_lines（サービス名/数量/金額/自己負担額）から構築。
   */
  detailLines?: ReceiptDetailLine[];

  /** 脚注を上書き（未指定は医療カテゴリのみ既定の四捨五入注記が入る） */
  footnote?: string;
}

/**
 * サービス利用明細の1行（明細書ページ）。
 * 円ベース（A: statement_lines）と単位ベース（B: レセプト区分02）の両対応。
 * 単位系フィールド（unitScore/totalUnits）が1つでもあると単位ベースで描画する。
 */
export interface ReceiptDetailLine {
  /** 内容（サービス名） */
  content: string;
  // 円ベース（A）
  /** 金額（費用総額） */
  amount?: number;
  /** うち自己負担額 */
  selfPay?: number | null;
  /** 数量。1以下や未指定は数量列を出さない判定に使う */
  quantity?: number | null;
  // 単位ベース（B: レセプト区分02）
  /** 単位数（単価） */
  unitScore?: number | null;
  /** 回数・日数 */
  count?: number | null;
  /** 合計単位数 */
  totalUnits?: number | null;
  // 自費（jihi: 住宅・その他費用）。施行規則65条の区分記載＋軽減税率表示用。
  /** 日付（表示文字列。例: 04/01）。家賃・共益費など月額固定は空 */
  date?: string | null;
  /** 分類（例: 食事（富士見・木部）、富士見・RH　オムツ）。空可 */
  category?: string | null;
  /** 税区分（非課税/内税/外税）。明細の内容欄に併記する */
  taxKind?: JihiTaxKind | null;
  /** 軽減税率（8%）対象☆か */
  reduced?: boolean | null;
}

/** 自費明細の税区分（住宅請求書サンプル準拠） */
export type JihiTaxKind = "非課税" | "内税" | "外税";

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
  /** サービス利用明細書（2ページ目）。null は出力しない */
  detail: ReceiptDetailModel | null;
}

/**
 * サービス利用明細書（描画用に解決済み・汎用テーブル）。
 * 円ベース/単位ベースのどちらも columns/rows/totalRow で表現する。
 */
export interface ReceiptDetailModel {
  /** ヘッダ列ラベル */
  columns: string[];
  /** 各列の寄せ（内容列=left、数値列=right） */
  aligns: Array<"left" | "right">;
  /** 各行のセル文字列（columns と同数） */
  rows: string[][];
  /** 合計行（先頭="合計"、非集計列は ""） */
  totalRow: string[];
  /** 横向き(A4 landscape)で描画するか（列数が多い項目別フル明細） */
  landscape: boolean;
  /** 明細書下部の注記（按分の旨など）。null は非表示 */
  note: string | null;
  /**
   * 列ごとの幅（flex重み）。未指定なら描画側の既定（先頭列＝広い/他＝狭い）。
   * 内容列が先頭でない明細（自費＝日付/分類/内容/金額）で内容列を広く取るために使う。
   */
  widths?: number[];
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

/** 既定の集金代行（代理受領）者。運営=株式会社ユニバーサルデベロップメント（前株） */
const DEFAULT_COLLECTION_AGENT = "株式会社ユニバーサルデベロップメント（QOLC）";

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
  // 明細書(B案)で項目別金額を実単価逆算するため、保険系の総額をここで保持。
  let insuranceCostTotal: number | undefined;

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
    insuranceCostTotal = costTotal;
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
  const detail = buildDetailModel(input.detailLines, {
    costTotal: insuranceCostTotal,
    userBurden: input.userBurden,
    category: input.category,
  });

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
    detail,
  };
}

/**
 * サービス利用明細書（2ページ目）を構築する。明細が無ければ null。
 * - 保険系(costTotal あり) かつ 単位明細 → 項目別フル(内容/単位数/回数/費用総額/給付額/自己負担額)。
 *   金額は実単価逆算で項目に配分し、各合計を確定額(費用総額/給付額/自己負担=領収額)に厳密一致。
 * - 単位明細のみ(総額なし) → 内容/単位数/回数/合計単位数。
 * - 円明細(statement_lines) → 内容/[数量]/金額/[自己負担額]。
 */
function buildDetailModel(
  lines: ReceiptDetailLine[] | undefined,
  opts: { costTotal?: number; userBurden?: number; category?: ReceiptCategory }
): ReceiptDetailModel | null {
  if (!lines || lines.length === 0) return null;
  const hasUnits = lines.some((l) => l.unitScore != null || l.totalUnits != null);
  // 自費（その他費用）: 施行規則65条の区分記載。日付/分類/内容(税区分・☆)/金額。
  // 自費は円ベースのため、単位明細(レセプト区分02)が来た場合は従来フォールバックに委ねる。
  if (opts.category === "jihi" && !hasUnits) return buildJihiDetail(lines);
  const hasAmount = lines.some((l) => l.amount != null);
  const hasSelfPay = lines.some((l) => l.selfPay != null);
  const totalsKnown = opts.costTotal != null && opts.userBurden != null;

  if (hasUnits) {
    // 介護レセプト(区分02): 単位数比で費用・自己負担を配分
    if (totalsKnown) return buildInsuranceFullDetail(lines, opts.costTotal!, opts.userBurden!, "kaigo");
    return buildUnitDetail(lines);
  }
  if (totalsKnown && hasAmount && !hasSelfPay) {
    // 医療UKE(KA): 費用は実額(amount)、自己負担のみ費用比で配分
    return buildInsuranceFullDetail(lines, opts.costTotal!, opts.userBurden!, "iryou");
  }
  // statement_lines 等（費用・自己負担が行ごとに既知）
  return buildYenDetail(lines);
}

/**
 * 重み(weights)に比例して total を整数配分する（最大剰余法）。
 * Σ結果 = total を厳密に保証。weights/total は負値可（減算行）。
 */
export function allocateByWeights(total: number, weights: number[]): number[] {
  const sumW = weights.reduce((s, w) => s + w, 0);
  if (sumW === 0) {
    // 単位数合計が0：先頭行に全額を寄せる（合計一致を優先）
    return weights.map((_, i) => (i === 0 ? total : 0));
  }
  const raw = weights.map((w) => (total * w) / sumW);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = total - floored.reduce((s, v) => s + v, 0); // 端数処理で常に >=0
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const res = floored.slice();
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) {
    res[order[k].i] += 1;
  }
  return res;
}

/** ▲付き or マイナス表記の円（負値は「-1,234円」）。0以上は通常表記。 */
function formatYenSigned(n: number): string {
  return `${formatNumber(n)}円`;
}

/**
 * 項目別フル明細（B案・横向き）。費用総額・保険給付額・自己負担額を項目別に表示。
 * - kaigo: 配分の重み＝合計単位数(totalUnits)。単位数列あり。
 * - iryou: 配分の重み＝費用(amount)。費用は実額。単位数列なし。
 * いずれも各列合計を確定額(費用総額/給付額/自己負担=領収額)に厳密一致させる。
 */
function buildInsuranceFullDetail(
  lines: ReceiptDetailLine[],
  costTotal: number,
  userBurden: number,
  mode: "kaigo" | "iryou"
): ReceiptDetailModel {
  const showUnits = mode === "kaigo";
  const weights = lines.map((l) => (showUnits ? l.totalUnits ?? 0 : l.amount ?? 0));
  const costs = allocateByWeights(costTotal, weights);
  const selfPays = allocateByWeights(userBurden, weights);

  const rows = lines.map((l, i) => {
    const cells = [l.content || "サービス利用"];
    if (showUnits) cells.push(l.unitScore != null && l.unitScore !== 0 ? formatNumber(l.unitScore) : "");
    cells.push(l.count != null && l.count !== 0 ? formatNumber(l.count) : "");
    cells.push(
      formatYenSigned(costs[i]),
      formatYenSigned(costs[i] - selfPays[i]), // 保険給付額 = 費用 − 自己負担
      formatYenSigned(selfPays[i])
    );
    return cells;
  });

  const columns = showUnits
    ? ["内容", "単位数", "回数", "費用総額", "保険給付額", "自己負担額"]
    : ["内容", "回数", "費用総額", "保険給付額", "自己負担額"];
  const aligns: Array<"left" | "right"> = columns.map((_, i) => (i === 0 ? "left" : "right"));

  const totalRow = ["合計"];
  if (showUnits) totalRow.push("");
  totalRow.push(
    "",
    formatYenSigned(costTotal),
    formatYenSigned(costTotal - userBurden),
    formatYenSigned(userBurden)
  );

  const note =
    mode === "iryou"
      ? "利用者負担額は各項目の費用比で按分しています（合計は領収金額と一致）。医療分は10円未満四捨五入。"
      : "金額は各サービスの単位数比で按分しています（合計は領収金額と一致）。";

  return { columns, aligns, rows, totalRow, landscape: true, note };
}

/** 単位ベース明細（総額情報が無い場合）。内容/単位数/回数/合計単位数 */
function buildUnitDetail(lines: ReceiptDetailLine[]): ReceiptDetailModel {
  let totalUnits = 0;
  const rows = lines.map((l) => {
    totalUnits += l.totalUnits ?? 0;
    return [
      l.content || "サービス利用",
      l.unitScore != null && l.unitScore !== 0 ? formatNumber(l.unitScore) : "",
      l.count != null && l.count !== 0 ? formatNumber(l.count) : "",
      l.totalUnits != null ? formatNumber(l.totalUnits) : "",
    ];
  });
  return {
    columns: ["内容", "単位数", "回数", "合計単位数"],
    aligns: ["left", "right", "right", "right"],
    rows,
    totalRow: ["合計", "", "", formatNumber(totalUnits)],
    landscape: false,
    note: null,
  };
}

/** 円ベース明細（A案: statement_lines）。内容/[数量]/金額/[自己負担額] */
function buildYenDetail(lines: ReceiptDetailLine[]): ReceiptDetailModel {
  const showQuantity = lines.some((l) => (l.quantity ?? 0) > 1);
  const showSelfPay = lines.some((l) => l.selfPay != null && l.selfPay !== l.amount);

  const columns = ["内容"];
  const aligns: Array<"left" | "right"> = ["left"];
  if (showQuantity) { columns.push("数量"); aligns.push("right"); }
  columns.push("金額"); aligns.push("right");
  if (showSelfPay) { columns.push("自己負担額"); aligns.push("right"); }

  let totalAmount = 0;
  let totalSelfPay = 0;
  const rows = lines.map((l) => {
    totalAmount += l.amount ?? 0;
    totalSelfPay += l.selfPay ?? 0;
    const cells = [l.content || "サービス利用"];
    if (showQuantity) cells.push((l.quantity ?? 0) > 0 ? formatNumber(l.quantity as number) : "");
    cells.push(formatYen(l.amount ?? 0));
    if (showSelfPay) cells.push(l.selfPay != null ? formatYen(l.selfPay) : "");
    return cells;
  });

  const totalRow = ["合計"];
  if (showQuantity) totalRow.push("");
  totalRow.push(formatYen(totalAmount));
  if (showSelfPay) totalRow.push(formatYen(totalSelfPay));

  return { columns, aligns, rows, totalRow, landscape: false, note: null };
}

/**
 * 自費（その他費用）明細書。住宅請求書タイプB サンプル準拠。
 * 列＝日付/分類/内容/金額。内容欄に税区分(非課税/内税/外税)と軽減税率☆を併記する。
 * 施行規則65条の保険外費用の区分記載に対応。QOLCは金額を独自計算せず確定額(amount)を表示。
 * - 日付/分類は1行でも値があれば列を出す（家賃・共益費など月額固定は空欄）。
 * - 合計＝Σ amount（領収金額＝本人請求と一致する想定）。
 */
function buildJihiDetail(lines: ReceiptDetailLine[]): ReceiptDetailModel {
  const showDate = lines.some((l) => (l.date ?? "") !== "");
  const showCategory = lines.some((l) => (l.category ?? "") !== "");
  const hasReduced = lines.some((l) => l.reduced === true);

  const columns: string[] = [];
  const aligns: Array<"left" | "right"> = [];
  const widths: number[] = [];
  // 内容列を最も広く、日付は狭め、金額は数値幅。
  if (showDate) { columns.push("日付"); aligns.push("left"); widths.push(1.4); }
  if (showCategory) { columns.push("分類"); aligns.push("left"); widths.push(3); }
  columns.push("内容"); aligns.push("left"); widths.push(5);
  columns.push("金額"); aligns.push("right"); widths.push(1.8);

  let total = 0;
  const rows = lines.map((l) => {
    total += l.amount ?? 0;
    const cells: string[] = [];
    if (showDate) cells.push(l.date ?? "");
    if (showCategory) cells.push(l.category ?? "");
    cells.push(formatJihiContent(l));
    cells.push(formatYen(l.amount ?? 0));
    return cells;
  });

  const totalRow = columns.map((_, i) =>
    i === 0 ? "合計" : i === columns.length - 1 ? formatYen(total) : ""
  );

  const note = hasReduced ? "☆ 軽減税率対象" : null;

  return { columns, aligns, rows, totalRow, landscape: false, note, widths };
}

/** 自費明細の内容欄文字列。「{内容}　(税区分) ☆」形式（サンプル準拠）。 */
function formatJihiContent(l: ReceiptDetailLine): string {
  let s = l.content || "その他費用";
  if (l.taxKind) s += `　(${l.taxKind})`;
  if (l.reduced) s += " ☆";
  return s;
}

/**
 * 集金代行（代理受領）の明記行を解決する。
 * provider を領収者（発行者）としつつ、UD/QOLCが代理受領した旨を明記する。
 */
function resolveAgentLine(collectionAgent?: string | null): string | null {
  if (collectionAgent === null) return null; // 明示的に非表示
  const agent = collectionAgent === undefined ? DEFAULT_COLLECTION_AGENT : collectionAgent;
  if (!agent) return null;
  return `集金代行（代理受領）：${agent}`;
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
  // 印紙不要の注記は既定で非表示（必要時のみ showStampDutyNote:true で明示）
  const showStamp = payment?.showStampDutyNote ?? false;
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
