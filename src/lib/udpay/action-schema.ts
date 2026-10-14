import { z } from "zod";

/**
 * UD Payment の画面操作 API（/api/udpay デモ・/api/billing 本番）の入力定義。
 * 画面部品は共通のため、両方の API が同じ action 名・同じ入力を受け付ける。
 */

export const lineSchema = z.object({
  description: z.string().min(1).max(100),
  quantity: z.number().int().min(1).max(99),
  unitPrice: z.number().int().min(-10_000_000).max(10_000_000),
  taxRate: z.number().int().min(0).max(10),
});

/** 顧客の入力項目（新規追加・編集で共通） */
const customerFields = {
  name: z.string().min(1).max(100),
  contactName: z.string().min(1).max(50),
  email: z.string().email(),
  cc: z.array(z.string().email()).max(10).optional(),
  anniversaryDay: z.number().int().min(1).max(28),
  note: z.string().max(500).optional(),
  postalCode: z.string().regex(/^\d{3}-?\d{4}$/).optional(),
  address1: z.string().max(100).optional(),
  address2: z.string().max(100).optional(),
};

export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createCustomer"), ...customerFields }),
  z.object({ action: z.literal("updateCustomer"), customerId: z.string().min(1), ...customerFields }),
  z.object({
    action: z.literal("registerCard"),
    token: z.string().min(1),
    cardNumber: z.string().min(14).max(23),
    expiry: z.string().max(7).optional(),
  }),
  z.object({ action: z.literal("sendRegistrationMail"), customerId: z.string().min(1) }),
  z.object({
    action: z.literal("copyPreviousMonth"),
    month: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  z.object({
    action: z.literal("createInvoice"),
    customerId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  z.object({
    action: z.literal("updateInvoiceLines"),
    invoiceId: z.string().min(1),
    lines: z.array(lineSchema).max(30),
  }),
  z.object({
    action: z.literal("updateInvoiceMail"),
    invoiceId: z.string().min(1),
    subject: z.string().max(200).optional(),
    comment: z.string().max(2000).optional(),
  }),
  z.object({ action: z.literal("reserveInvoices"), invoiceIds: z.array(z.string().min(1)).min(1).max(500) }),
  z.object({ action: z.literal("revertToDraft"), invoiceId: z.string().min(1) }),
  z.object({ action: z.literal("confirmInvoices"), invoiceIds: z.array(z.string().min(1)).min(1).max(500) }),
  z.object({ action: z.literal("cancelConfirmation"), invoiceId: z.string().min(1) }),
  z.object({
    action: z.literal("importInvoiceCsv"),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    rows: z
      .array(
        z.object({
          line: z.number().int().min(1),
          name: z.string().max(100).optional(),
          email: z.string().max(200).optional(),
          description: z.string().min(1).max(100),
          quantity: z.number().int().min(1).max(99),
          unitPrice: z.number().int().min(-10_000_000).max(10_000_000),
        }),
      )
      .min(1)
      .max(500),
  }),
  z.object({ action: z.literal("runChargeBatch") }),
  z.object({ action: z.literal("retryPayment"), paymentId: z.string().min(1) }),
  z.object({ action: z.literal("resetDemo") }),
]);

/** 操作の入力 */
export type UdpayAction = z.infer<typeof actionSchema>;
