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
import type { ReceiptCategory, ReceiptInput } from "./receipt-model";

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

  // 明細から費用総額・本人負担を集計（明細が無ければ payment.total_amount を本人負担に）
  const costTotalFromLines = lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  const userBurden = lines.length
    ? lines.reduce((s, l) => s + (l.self_pay_amount ?? 0), 0)
    : payment.total_amount;
  const costTotal = lines.length ? costTotalFromLines : userBurden;
  const benefit = costTotal - userBurden;

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
    // サービス利用明細書（2ページ目）の元データ。明細があるときのみ付与。
    detailLines: lines.length
      ? lines.map((l) => ({
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
  }

  return input;
}
