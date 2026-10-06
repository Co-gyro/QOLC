import type { UdpayCustomer, UdpayInvoiceLine, UdpayStore } from "./types";
import {
  chargeDateFor,
  computeTotals,
  currentMonth,
  nextMonth,
  previousMonth,
  todayJst,
} from "./logic";

/** シードデータのバージョン。構造を変えたら上げる（ストアが自動で作り直される） */
export const SEED_VERSION = 4;

/** "YYYY-MM" を有効期限 "YYYYMM" にする */
function ym(month: string): string {
  return month.replace("-", "");
}

/**
 * UD Payment デモの初期データを生成する。
 * ランサイド様の実態（歯科医院向け月次サポート・交通費実費・顧客ごとの決済日）
 * に寄せた架空の顧客7件と、前々月・前月分の請求（決済確定済み）を含む。
 * 前月分は決済日が今日以前なら入金済み、先なら決済確定（課金待ち）になる。
 * 有効期限が近い顧客（ひかり歯科）と期限切れの顧客（こだま歯科）を1件ずつ入れる。
 * 「前月」は実行時点の実カレンダーで決める（月替わり時の再シードは loadStore 側）。
 */
export function buildSeed(): UdpayStore {
  const TODAY = todayJst();
  const CUR = currentMonth();
  const PREV = previousMonth(CUR);
  const PREV2 = previousMonth(PREV);
  /** 決済確定済みの請求書を生成するヘルパー */
  function invoice(month: string, customerId: string, lines: UdpayInvoiceLine[]) {
    const at = `${nextMonth(month)}-01T10:00:00+09:00`;
    return {
      id: `inv-${customerId.replace("cust-", "")}-${month}`,
      customerId,
      month,
      lines,
      status: "confirmed" as const,
      reservedAt: at,
      confirmedAt: at,
      mailSentAt: at,
    };
  }
  /** 顧客を生成するヘルパー */
  function customer(
    key: string,
    name: string,
    contactName: string,
    day: number,
    card: UdpayCustomer["card"],
    extra: Partial<UdpayCustomer> = {},
  ): UdpayCustomer {
    return {
      id: `cust-${key}`,
      name,
      contactName,
      email: `demo-${key}@example.com`,
      cc: [],
      anniversaryDay: day,
      registrationToken: `demo-${key}`,
      card,
      createdAt: "2025-11-01T09:00:00+09:00",
      ...extra,
    };
  }
  const visa = (last4: string, expireYm: string) => ({
    registered: true,
    maskedNumber: `**** **** **** ${last4}`,
    brand: "Visa",
    expireYm,
    registeredAt: "2025-11-14T10:00:00+09:00",
  });
  const store: UdpayStore = {
    customers: [
      customer("sakura", "さくら歯科クリニック", "田中", 14, visa("4242", "202903"), {
        cc: ["keiri-sakura@example.com"],
        note: "請求書は院長と経理の両方へ",
        postalCode: "150-0001",
        address1: "東京都渋谷区神宮前1-2-3",
        address2: "さくらビル2階",
      }),
      customer("minato", "みなと歯科医院", "佐藤", 5, {
        ...visa("0505", "202811"),
        brand: "JCB",
        demoFailOnce: true,
      }, { postalCode: "220-0012", address1: "神奈川県横浜市西区みなとみらい4-5-6" }),
      customer("hikari", "ひかり歯科", "鈴木", 14, {
        ...visa("1414", ym(nextMonth(CUR))),
        brand: "Mastercard",
      }),
      customer("aoba", "あおば歯科クリニック", "高橋", 20, visa("2020", "202807")),
      customer("umikaze", "うみかぜ歯科医院", "宮里", 25, { ...visa("2525", "203001"), brand: "JCB" }, {
        note: "交通費（航空券）が毎月変動",
        postalCode: "900-0015",
        address1: "沖縄県那覇市久茂地7-8-9",
      }),
      customer("kodama", "こだま歯科クリニック", "児玉", 10, visa("1010", ym(PREV)), {
        note: "数か月に1回の請求",
      }),
      customer("wakaba", "わかば歯科", "伊藤", 10, { registered: false }, {
        createdAt: "2026-07-21T09:00:00+09:00",
      }),
    ],
    invoices: [
      ...[PREV2, PREV].flatMap((month) => [
        invoice(month, "cust-sakura", [line("基本サポート料金", 9_900), line("歯科医院支援サポート料金", 169_800)]),
        invoice(month, "cust-minato", [
          line("基本サポート料金", 9_900),
          line("歯科医院支援サポート料金（3医院分）", 169_800, 3),
          line("労務管理サポート", 55_000),
        ]),
        invoice(month, "cust-hikari", [line("基本サポート料金", 9_900), line("労務管理サポート", 55_000)]),
        invoice(month, "cust-aoba", [line("基本サポート料金", 9_900), line("歯科医院支援サポート料金", 169_800)]),
        invoice(month, "cust-umikaze", [
          line("基本サポート料金", 9_900),
          line("歯科医院支援サポート料金", 169_800),
          line("交通費（羽田〜那覇往復航空券）", month === PREV ? 157_964 : 98_400),
        ]),
      ]),
      invoice(PREV2, "cust-kodama", [line("基本サポート料金", 9_900), line("初回訪問サポート（値引き）", -5_000)]),
    ],
    payments: [],
    seedVersion: SEED_VERSION,
  };

  // 決済日が今日以前の請求は入金済み、先の請求は決済確定（課金待ち）として seed する
  for (const inv of store.invoices) {
    const c = store.customers.find((x) => x.id === inv.customerId);
    if (!c) continue;
    const { total } = computeTotals(inv.lines);
    const scheduledDate = chargeDateFor(inv.month, c.anniversaryDay);
    const done = scheduledDate <= TODAY;
    store.payments.push({
      id: `pay-${inv.id}`,
      invoiceId: inv.id,
      customerId: inv.customerId,
      amount: total,
      scheduledDate,
      status: done ? "paid" : "scheduled",
      attempts: done ? [{ at: `${scheduledDate}T05:00:00+09:00`, result: "paid" }] : [],
      paidAt: done ? `${scheduledDate}T05:00:00+09:00` : undefined,
    });
  }
  return store;
}

/** 明細行を生成するヘルパー */
function line(description: string, unitPrice: number, quantity = 1): UdpayInvoiceLine {
  return {
    id: `line-${description}-${unitPrice}`,
    description,
    quantity,
    unitPrice,
    taxRate: 10,
  };
}
