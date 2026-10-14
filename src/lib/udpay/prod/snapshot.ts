import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  UdpayCustomer,
  UdpayInvoice,
  UdpayInvoiceStatus,
  UdpayPayment,
  UdpayStore,
} from "../types";
import { listCustomers, type ProdCustomer } from "./customers";

/**
 * 本番テーブルから、加盟店1社分のデータをデモと同じ形（UdpayStore）で読み出す。
 * 画面（一覧・詳細・帳票）はデモと共通の部品で表示する。書き込みは billing-actions.ts で行う。
 *
 * 状態の対応: draft=下書き / submitted=課金予約 / approved=決済確定（以降は決済の状態）。
 * 決済の状態: scheduled・processing=課金待ち / captured=入金済み / failed=与信落ち。
 * 取り下げた請求（cancelled）と、決済確定の取消で cancelled になった決済は表示しない。
 */

const INVOICE_STATUS: Record<string, UdpayInvoiceStatus | undefined> = {
  draft: "draft",
  submitted: "reserved",
  approved: "confirmed",
};

const PAYMENT_STATUS: Record<string, UdpayPayment["status"] | undefined> = {
  scheduled: "scheduled",
  processing: "scheduled",
  captured: "paid",
  refunded: "paid",
  failed: "failed",
};

/** 本番の顧客をデモの顧客の形にする（宛先は To の先頭を主宛先、残りを CC 扱い） */
export function toViewCustomer(c: ProdCustomer, mailSentAt?: string): UdpayCustomer {
  const to = c.contacts.filter((x) => x.kind === "to").map((x) => x.email);
  const cc = c.contacts.filter((x) => x.kind === "cc").map((x) => x.email);
  return {
    id: c.id,
    name: c.name,
    contactName: c.contactName ?? "",
    email: to[0] ?? "",
    cc: [...to.slice(1), ...cc],
    anniversaryDay: c.chargeDay ?? 15,
    postalCode: c.postalCode ?? undefined,
    address1: c.address1 ?? undefined,
    address2: c.address2 ?? undefined,
    note: c.internalMemo ?? undefined,
    registrationToken: c.registrationToken,
    registrationMailSentAt: mailSentAt,
    card: {
      registered: Boolean(c.usenMemberId),
      maskedNumber: c.cardLast4 ? `**** **** **** ${c.cardLast4}` : undefined,
      brand: c.cardBrand ?? undefined,
      expireYm: c.cardExpireYm ?? undefined,
      registeredAt: c.cardRegisteredAt ?? undefined,
    },
    createdAt: "",
  };
}

interface InvoiceRow {
  id: string;
  customer_id: string;
  service_month: string;
  status: string;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  mail_sent_at: string | null;
  mail_subject: string | null;
  mail_comment: string | null;
  confirmation_cancelled_at: string | null;
}

interface LineRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

interface PaymentRow {
  id: string;
  invoice_id: string;
  customer_id: string;
  amount: number;
  scheduled_date: string;
  status: string;
  attempt_count: number;
  last_error_code: string | null;
  captured_at: string | null;
  updated_at: string;
}

/** 失敗のない Supabase 応答から行を取り出す */
function rows<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}の取得に失敗: ${res.error.message}`);
  return (res.data ?? []) as T[];
}

/** 加盟店1社分を読み出す */
export async function loadBillingStore(client: SupabaseClient, merchantId: string): Promise<UdpayStore> {
  const customers = await listCustomers(client, merchantId);
  const [invRes, payRes, mailRes] = await Promise.all([
    client
      .from("udpay_invoices")
      .select("id, customer_id, service_month, status, submitted_at, submitted_by, approved_at, mail_sent_at, mail_subject, mail_comment, confirmation_cancelled_at")
      .eq("merchant_id", merchantId)
      .is("deleted_at", null)
      .neq("status", "cancelled"),
    client
      .from("udpay_payments")
      .select("id, invoice_id, customer_id, amount, scheduled_date, status, attempt_count, last_error_code, captured_at, updated_at")
      .eq("merchant_id", merchantId)
      .neq("status", "cancelled"),
    client
      .from("udpay_mail_logs")
      .select("customer_id, created_at")
      .eq("merchant_id", merchantId)
      .eq("kind", "card_registration")
      .eq("status", "sent")
      .order("created_at", { ascending: false }),
  ]);
  const invoices = rows<InvoiceRow>(invRes, "請求");
  const payments = rows<PaymentRow>(payRes, "決済");
  const mails = rows<{ customer_id: string; created_at: string }>(mailRes, "送付履歴");
  const lineRes = invoices.length
    ? await client
        .from("udpay_invoice_lines")
        .select("id, invoice_id, description, quantity, unit_price, tax_rate")
        .in("invoice_id", invoices.map((i) => i.id))
        .is("deleted_at", null)
        .order("sort")
    : { data: [], error: null };
  const lines = rows<LineRow>(lineRes, "明細");

  const viewInvoices: UdpayInvoice[] = invoices.flatMap((i) => {
    const status = INVOICE_STATUS[i.status];
    if (!status) return [];
    return [
      {
        id: i.id,
        customerId: i.customer_id,
        month: i.service_month,
        status,
        lines: lines
          .filter((l) => l.invoice_id === i.id)
          .map((l) => ({
            id: l.id,
            description: l.description,
            quantity: l.quantity,
            unitPrice: Number(l.unit_price),
            taxRate: l.tax_rate,
          })),
        reservedAt: i.submitted_at ?? undefined,
        reservedBy: i.submitted_by ?? undefined,
        confirmedAt: i.approved_at ?? undefined,
        mailSubject: i.mail_subject ?? undefined,
        mailComment: i.mail_comment ?? undefined,
        mailSentAt: i.mail_sent_at ?? undefined,
        confirmationCancelledAt: i.confirmation_cancelled_at ?? undefined,
      },
    ];
  });
  const viewPayments: UdpayPayment[] = payments.flatMap((p) => {
    const status = PAYMENT_STATUS[p.status];
    if (!status) return [];
    // 試行回数は件数だけ再現する（最後の試行の成否を反映）
    const attempts = Array.from({ length: p.attempt_count }, (_, n) => ({
      at: p.updated_at,
      result: n === p.attempt_count - 1 && status === "paid" ? ("paid" as const) : ("failed" as const),
      reason: p.last_error_code ?? undefined,
    }));
    return [
      {
        id: p.id,
        invoiceId: p.invoice_id,
        customerId: p.customer_id,
        amount: Number(p.amount),
        scheduledDate: p.scheduled_date,
        status,
        attempts,
        paidAt: p.captured_at ?? undefined,
      },
    ];
  });
  const lastMail = new Map<string, string>();
  for (const m of mails) if (!lastMail.has(m.customer_id)) lastMail.set(m.customer_id, m.created_at);
  return {
    customers: customers.map((c) => toViewCustomer(c, lastMail.get(c.id))),
    invoices: viewInvoices,
    payments: viewPayments,
    seedVersion: 0,
  };
}
