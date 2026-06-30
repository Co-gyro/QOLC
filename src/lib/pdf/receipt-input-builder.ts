/**
 * 決済データ → 領収書 ReceiptInput ビルダー（純粋ロジック層）
 *
 * payments / statement_lines / residents / merchants / facilities の各行（取得済み）から
 * 利用料請求書兼領収書の入力（ReceiptInput）を組み立てる。DBアクセスは呼び出し側が行い、
 * ここは値の変換のみ（テスト容易性のため副作用なし）。
 *
 * 金額の対応（[[project_receipt_invoice_format]]）:
 *   - 本人請求額(userBurden) = Σ statement_lines.self_pay_amount = payment.total_amount
 *   - 費用総額(costTotal)    = Σ statement_lines.amount
 *   - 保険給付額             = costTotal - userBurden（モデル側で導出）
 *
 * カテゴリ判定:
 *   - 給付額 > 0 → 保険（既定 kaigo。医療/介護は明細から判別不可のため override 可）
 *   - 給付額 = 0 → jihi（全額自己負担＝その他費用）
 */
import type { ReceiptCategory, ReceiptInput, ReceiptDetailLine, ReceiptTaxBucket } from "./receipt-model";
import { resolveServiceName } from "@/lib/receipt/kaigo-service-codes";
import { resolveIryouServiceName } from "@/lib/receipt/iryou-service-codes";
import type { KaigoServiceDetail } from "@/lib/receipt/kaigo-csv";

/** 領収書生成に必要な決済関連データ（DB取得済みの素の値） */
export interface PaymentReceiptData {
  payment: {
    /** 決済金額（円）＝本人請求総額 */
    total_amount: number;
    /** 売上計上日時（ISO）。決済日として使用 */
    captured_at: string | null;
    /** 作成日時（ISO）。captured_at 不在時のフォールバック */
    created_at: string;
  };
  /** この決済に紐づく明細行（statement_lines） */
  lines: Array<{
    amount: number;
    self_pay_amount: number;
    service_name: string | null;
    quantity?: number | null;
    /** 'insurance'(保険分・既定) / 'other'(その他費用＝保険外) */
    cost_kind?: string | null;
    /** その他費用の10%対象額(税込)。任意 */
    tax_10_amount?: number | null;
    /** その他費用の8%対象☆額(税込)。任意 */
    tax_8_amount?: number | null;
    /** 公費負担額(公費請求額・円)。公費併用時のみ>0 */
    koufu_amount?: number | null;
  }>;
  /** 入居者（宛名） */
  resident: { name_last: string; name_first: string };
  /** 提供者（領収者ボックス） */
  merchant: { name: string; address: string | null; phone: string | null };
  /** 施設（宛先住所に使用）。任意 */
  facility?: { name: string | null; address: string | null } | null;
  /** カテゴリ上書き（kaigo/iryou/jihi）。未指定は給付額から自動判定 */
  category?: ReceiptCategory;
  /** 帳票番号（任意） */
  documentNo?: string;
  /** カードブランド（任意・payments未保持のため通常は無し） */
  cardBrand?: string;
  /** 発行日（ISO）。呼び出し側が当日を渡す */
  issuedAtIso: string;
  /** 集金代行（代理受領）者名の上書き。未指定はモデル既定（UD）。null で非表示 */
  collectionAgent?: string | null;
  /** 適格請求書発行事業者 登録番号（T+13桁）。任意 */
  invoiceRegistrationNumber?: string;
}

/**
 * 介護レセプトのサービス明細（区分02）を、明細書ページ用の単位ベース明細行に変換する。
 * サービス名はサービスコード表マスタで解決（未取り込みの項目はコード併記）。
 * レセプトには日付・時間が無いため、サービスコード単位の単位数・回数で構成する（B案）。
 */
export function buildKaigoDetailLines(
  serviceDetails: KaigoServiceDetail[]
): ReceiptDetailLine[] {
  return serviceDetails.map((d) => ({
    content: resolveServiceName(d.serviceTypeCode, d.serviceItemCode),
    unitScore: d.unitScore,
    count: d.count,
    totalUnits: d.totalUnits,
  }));
}

/**
 * 医療UKEの算定項目明細（コード別集計）を、明細書ページ用の明細行に変換する。
 * 訪問看護療養費は円建てのため費用(amount)は実額、自己負担はモデル側で費用比配分。
 * 名称は訪問看護療養費マスターで解決（未取込コードはコード表示）。
 */
export function buildIryouDetailLines(
  details: Array<{ code: string; totalAmount: number; count: number }>
): ReceiptDetailLine[] {
  return details.map((d) => ({
    content: resolveIryouServiceName(d.code),
    count: d.count,
    amount: d.totalAmount,
  }));
}

/**
 * 自費請求（住宅・その他費用）の1明細。施設の請求ソフトが出力する確定値を想定。
 * QOLCは金額を独自計算せず、確定額(amount)・税区分・軽減税率フラグを直読する（星さん方針）。
 * 取込経路（請求ソフト出力フォーマット）は提供者ごとに異なるため後工程で実装する。
 */
export interface JihiCostItem {
  /** 内容（例: 昼食、洗濯＿小、家賃） */
  content: string;
  /** 確定金額（円・税込） */
  amount: number;
  /** 日付（表示文字列。例: 04/01）。月額固定（家賃等）は無し */
  date?: string | null;
  /** 分類（例: 食事（富士見・木部）、富士見・RH　オムツ） */
  category?: string | null;
  /** 税区分（非課税/内税/外税） */
  taxKind?: "非課税" | "内税" | "外税" | null;
  /** 軽減税率（8%）対象か */
  reduced?: boolean | null;
}

/**
 * 自費請求（その他費用）明細を、明細書ページ用の明細行に変換する。
 * 施行規則65条の保険外費用の区分記載＋軽減税率☆表示に対応（住宅請求書タイプB準拠）。
 */
export function buildJihiDetailLines(
  items: JihiCostItem[]
): ReceiptDetailLine[] {
  return items.map((it) => ({
    content: it.content,
    amount: it.amount,
    date: it.date ?? null,
    category: it.category ?? null,
    taxKind: it.taxKind ?? null,
    reduced: it.reduced ?? null,
  }));
}

/** ISO文字列(yyyy-mm-dd...) を和暦の年月日に分解（TZ非依存・先頭10文字を使用） */
function warekiParts(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map((s) => Number(s));
  return { year: y, month: m, day: d };
}

/** 西暦年→令和年（2019=令和元年）。令和より前は西暦のまま扱わない前提の運用範囲 */
function reiwaYear(year: number): number {
  return year - 2018;
}

/** 令和N年M月（請求年月用） */
export function formatWarekiMonth(iso: string): string {
  const { year, month } = warekiParts(iso);
  return `令和${reiwaYear(year)}年${month}月`;
}

/** 令和N年M月D日（発行日・決済日用） */
export function formatWarekiDate(iso: string): string {
  const { year, month, day } = warekiParts(iso);
  return `令和${reiwaYear(year)}年${month}月${day}日`;
}

/**
 * 決済データから ReceiptInput を組み立てる。
 */
export function buildReceiptInputFromPayment(
  data: PaymentReceiptData
): ReceiptInput {
  const { payment, lines } = data;

  // cost_kind で 保険分 と その他費用(保険外) に分離する。
  const insuranceLines = lines.filter((l) => (l.cost_kind ?? "insurance") !== "other");
  const otherLines = lines.filter((l) => (l.cost_kind ?? "insurance") === "other");

  // 保険分の集計（明細が無ければ payment.total_amount を本人負担に）
  const insuranceCostTotal = insuranceLines.reduce((s, l) => s + (l.amount ?? 0), 0);
  const insuranceSelf = insuranceLines.reduce((s, l) => s + (l.self_pay_amount ?? 0), 0);
  // 公費負担額（公費請求額の合計）。費用総額に内包され、保険給付額とは独立に表示する。
  const koufuBenefit = insuranceLines.reduce((s, l) => s + (l.koufu_amount ?? 0), 0);
  // その他費用の集計
  const otherTotal = otherLines.reduce((s, l) => s + (l.self_pay_amount ?? 0), 0);
  const otherTax10 = otherLines.reduce((s, l) => s + (l.tax_10_amount ?? 0), 0);
  const otherTax8 = otherLines.reduce((s, l) => s + (l.tax_8_amount ?? 0), 0);

  // 領収金額（grand total）＝全 self_pay。明細無しは payment.total_amount。
  const userBurden = lines.length ? insuranceSelf + otherTotal : payment.total_amount;
  // 保険分の費用総額（その他費用は含めない）。保険明細が無ければ本人負担と同額。
  const costTotal = insuranceLines.length ? insuranceCostTotal : insuranceSelf;
  const benefit = costTotal - insuranceSelf;

  // 給付額があれば保険カテゴリ、無ければ（全額自己負担）自費。
  const category: ReceiptCategory =
    data.category ?? (benefit > 0 ? "kaigo" : "jihi");

  // 請求年月は決済（売上計上）月。未計上なら作成月。
  const periodIso = payment.captured_at ?? payment.created_at;
  const billingMonth = formatWarekiMonth(periodIso);
  const issuedAt = formatWarekiDate(data.issuedAtIso);
  const settledAt = payment.captured_at
    ? formatWarekiDate(payment.captured_at)
    : undefined;

  const recipientName = `${data.resident.name_last} ${data.resident.name_first}`.trim();

  const input: ReceiptInput = {
    category,
    documentNo: data.documentNo,
    issuedAt,
    billingMonth,
    recipientName,
    recipientAddress: data.facility?.address ?? undefined,
    userBurden,
    provider: {
      name: data.merchant.name,
      address: data.merchant.address ?? undefined,
      tel: data.merchant.phone ?? undefined,
    },
    payment: {
      brand: data.cardBrand,
      settledAt,
    },
    collectionAgent: data.collectionAgent,
    invoiceRegistrationNumber: data.invoiceRegistrationNumber,
    // サービス利用明細書（2ページ目）の元データ。保険明細のみ（その他費用は合算区分1行）。
    detailLines: insuranceLines.length
      ? insuranceLines.map((l) => ({
          content: l.service_name ?? "サービス利用",
          quantity: l.quantity ?? null,
          amount: l.amount ?? 0,
          selfPay: l.self_pay_amount ?? null,
        }))
      : undefined,
  };

  // 保険系のみ費用総額を渡す（モデルが給付額を導出）。自費は本人負担のみ。
  if (category !== "jihi") {
    input.costTotal = costTotal;
    if (koufuBenefit > 0) input.koufuBenefit = koufuBenefit;
    // その他費用（保険外）があれば合算区分として付与（施行規則65条の区分記載）。
    if (otherTotal > 0) {
      input.otherCost = {
        total: otherTotal,
        tax10: otherTax10 > 0 ? taxBucketFromGross(otherTax10, 1.1) : undefined,
        tax8: otherTax8 > 0 ? taxBucketFromGross(otherTax8, 1.08) : undefined,
      };
    }
  }

  return input;
}

/**
 * 内税の税込対象額から消費税額を算出して ReceiptTaxBucket を作る。
 * QOLCは税額を独自計算しないが、CSVが対象額のみ（税額なし）の場合の表示補完。
 * 内税合計の丸めにより施設の確定税額と1円程度ずれることがある（許容）。
 */
function taxBucketFromGross(gross: number, rate: number): ReceiptTaxBucket {
  const net = Math.round(gross / rate);
  return { amount: gross, tax: gross - net };
}
