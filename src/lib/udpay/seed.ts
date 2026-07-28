import type { UdpayStore } from "./types";
import { chargeDateFor, computeTotals } from "./logic";

/** シードデータのバージョン。構造を変えたら上げる（ストアが自動で作り直される） */
export const SEED_VERSION = 1;

/** デモの「前月」（サービス提供月）。この月の請求は確定・入金済みとして seed する */
const PREV_MONTH = "2026-06";

/**
 * UD Payment デモの初期データを生成する。
 * ランサイド様の実態（歯科医院向け月次サポート・交通費実費・アニバーサリー日課金）
 * に寄せた架空の顧客6件と、前月分の確定済み請求・入金済み決済を含む。
 */
export function buildSeed(): UdpayStore {
  const store: UdpayStore = {
    customers: [
      {
        id: "cust-sakura",
        name: "さくら歯科クリニック",
        contactName: "田中",
        email: "demo-sakura@example.com",
        anniversaryDay: 14,
        registrationToken: "demo-sakura",
        card: {
          registered: true,
          maskedNumber: "**** **** **** 4242",
          brand: "Visa",
          registeredAt: "2025-11-14T10:00:00+09:00",
        },
        createdAt: "2025-11-01T09:00:00+09:00",
      },
      {
        id: "cust-minato",
        name: "みなと歯科医院",
        contactName: "佐藤",
        email: "demo-minato@example.com",
        anniversaryDay: 5,
        registrationToken: "demo-minato",
        card: {
          registered: true,
          maskedNumber: "**** **** **** 0505",
          brand: "JCB",
          registeredAt: "2025-12-05T10:00:00+09:00",
          demoFailOnce: true,
        },
        createdAt: "2025-12-01T09:00:00+09:00",
      },
      {
        id: "cust-hikari",
        name: "ひかり歯科",
        contactName: "鈴木",
        email: "demo-hikari@example.com",
        anniversaryDay: 14,
        registrationToken: "demo-hikari",
        card: {
          registered: true,
          maskedNumber: "**** **** **** 1414",
          brand: "Mastercard",
          registeredAt: "2026-01-14T10:00:00+09:00",
        },
        createdAt: "2026-01-06T09:00:00+09:00",
      },
      {
        id: "cust-aoba",
        name: "あおば歯科クリニック",
        contactName: "高橋",
        email: "demo-aoba@example.com",
        anniversaryDay: 20,
        registrationToken: "demo-aoba",
        card: {
          registered: true,
          maskedNumber: "**** **** **** 2020",
          brand: "Visa",
          registeredAt: "2026-02-20T10:00:00+09:00",
        },
        createdAt: "2026-02-12T09:00:00+09:00",
      },
      {
        id: "cust-umikaze",
        name: "うみかぜ歯科医院",
        contactName: "宮里",
        email: "demo-umikaze@example.com",
        anniversaryDay: 25,
        registrationToken: "demo-umikaze",
        card: {
          registered: true,
          maskedNumber: "**** **** **** 2525",
          brand: "JCB",
          registeredAt: "2026-03-25T10:00:00+09:00",
        },
        createdAt: "2026-03-18T09:00:00+09:00",
      },
      {
        id: "cust-wakaba",
        name: "わかば歯科",
        contactName: "伊藤",
        email: "demo-wakaba@example.com",
        anniversaryDay: 10,
        registrationToken: "demo-wakaba",
        card: { registered: false },
        createdAt: "2026-07-21T09:00:00+09:00",
      },
    ],
    invoices: [
      invoice("inv-sakura-06", "cust-sakura", [
        line("基本サポート料金", 9_900),
        line("歯科医院支援サポート料金", 169_800),
      ]),
      invoice("inv-minato-06", "cust-minato", [
        line("基本サポート料金", 9_900),
        line("歯科医院支援サポート料金（3医院分）", 169_800, 3),
        line("労務管理サポート", 55_000),
      ]),
      invoice("inv-hikari-06", "cust-hikari", [
        line("基本サポート料金", 9_900),
        line("労務管理サポート", 55_000),
      ]),
      invoice("inv-aoba-06", "cust-aoba", [
        line("基本サポート料金", 9_900),
        line("歯科医院支援サポート料金", 169_800),
      ]),
      invoice("inv-umikaze-06", "cust-umikaze", [
        line("基本サポート料金", 9_900),
        line("歯科医院支援サポート料金", 169_800),
        line("交通費（羽田〜那覇往復航空券）", 157_964),
      ]),
    ],
    payments: [],
    seedVersion: SEED_VERSION,
  };

  // 前月分の決済は全件「入金済み」として seed する
  for (const inv of store.invoices) {
    const customer = store.customers.find((c) => c.id === inv.customerId);
    if (!customer) continue;
    const { total } = computeTotals(inv.lines);
    const scheduledDate = chargeDateFor(inv.month, customer.anniversaryDay);
    store.payments.push({
      id: `pay-${inv.id}`,
      invoiceId: inv.id,
      customerId: inv.customerId,
      amount: total,
      scheduledDate,
      status: "paid",
      attempts: [{ at: `${scheduledDate}T05:00:00+09:00`, result: "paid" }],
      paidAt: `${scheduledDate}T05:00:00+09:00`,
    });
  }
  return store;
}

/** 明細行を生成するヘルパー */
function line(description: string, unitPrice: number, quantity = 1) {
  return {
    id: `line-${description}-${unitPrice}`,
    description,
    quantity,
    unitPrice,
    taxRate: 10,
  };
}

/** 前月分の確定済み請求書を生成するヘルパー */
function invoice(
  id: string,
  customerId: string,
  lines: ReturnType<typeof line>[],
) {
  return {
    id,
    customerId,
    month: PREV_MONTH,
    lines,
    status: "confirmed" as const,
    confirmedAt: "2026-07-02T10:00:00+09:00",
    mailSentAt: "2026-07-02T10:00:00+09:00",
  };
}
