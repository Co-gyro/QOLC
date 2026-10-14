import { createCustomer, getCustomer, updateCustomer, type CustomerInput } from "./customers";
import { getUdpayMerchant } from "./merchants";
import { registrationUrl } from "./identifiers";
import { sendCardRegistrationMail } from "./mail";
import type { BillingCtx, Result } from "./invoices";

/**
 * UD Payment（本番）の顧客の登録・編集・カード登録案内（加盟店の担当者が /billing から行う）。
 * 画面はデモと共通のため、入力はデモの形（主宛先 email ＋ CC）で受け、本番の形（宛先の一覧）に変換する。
 */

/** 画面からの顧客入力（デモと共通の形） */
export interface ScreenCustomerInput {
  name: string;
  contactName: string;
  email: string;
  cc?: string[];
  anniversaryDay: number;
  note?: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
}

/** 画面の入力を本番の入力に変換する */
export function toCustomerInput(input: ScreenCustomerInput): CustomerInput {
  return {
    name: input.name,
    contactName: input.contactName,
    chargeDay: input.anniversaryDay,
    internalMemo: input.note ?? null,
    postalCode: input.postalCode ?? null,
    address1: input.address1 ?? null,
    address2: input.address2 ?? null,
    contacts: [
      { kind: "to", email: input.email },
      ...(input.cc ?? []).map((email) => ({ kind: "cc" as const, email })),
    ],
  };
}

/** 決済日が加盟店の候補（例: 15日・28日）に入っているか */
async function checkChargeDay(ctx: BillingCtx, day: number, current?: number | null): Promise<string | null> {
  const merchant = await getUdpayMerchant(ctx.client, ctx.member.merchantId);
  if (!merchant) return "加盟店の設定がありません";
  if (merchant.chargeDays.includes(day) || day === current) return null;
  return `決済日は ${merchant.chargeDays.join("・")}日 から選んでください`;
}

/** 顧客を登録する（カード登録リンクのトークンを発行） */
export async function createBillingCustomer(ctx: BillingCtx, input: ScreenCustomerInput): Promise<Result> {
  const dayError = await checkChargeDay(ctx, input.anniversaryDay);
  if (dayError) return { ok: false, error: dayError };
  await createCustomer(ctx.client, ctx.member.merchantId, toCustomerInput(input));
  return { ok: true };
}

/** 顧客を編集する（自社の顧客のみ。カード情報・登録リンクは変えない） */
export async function updateBillingCustomer(ctx: BillingCtx, customerId: string, input: ScreenCustomerInput): Promise<Result> {
  const current = await getCustomer(ctx.client, customerId);
  if (!current || current.merchantId !== ctx.member.merchantId) return { ok: false, error: "顧客が見つかりません" };
  const dayError = await checkChargeDay(ctx, input.anniversaryDay, current.chargeDay);
  if (dayError) return { ok: false, error: dayError };
  const updated = await updateCustomer(ctx.client, customerId, {
    ...toCustomerInput(input),
    // 画面にない項目（請求書の備考）は変えない
    billingNote: current.billingNote,
  });
  return updated ? { ok: true } : { ok: false, error: "顧客が見つかりません" };
}

/** カード登録のご案内メールを送る（送付履歴に記録） */
export async function sendBillingRegistrationMail(ctx: BillingCtx, customerId: string, origin: string): Promise<Result> {
  const customer = await getCustomer(ctx.client, customerId);
  if (!customer || customer.merchantId !== ctx.member.merchantId) return { ok: false, error: "顧客が見つかりません" };
  const merchant = await getUdpayMerchant(ctx.client, ctx.member.merchantId);
  if (!merchant) return { ok: false, error: "加盟店の設定がありません" };
  const base = process.env.NEXT_PUBLIC_APP_URL || origin;
  const r = await sendCardRegistrationMail(ctx.client, {
    customer,
    merchant,
    url: registrationUrl(customer.registrationToken, base),
    sentBy: ctx.member.userId,
  });
  return r.status === "failed" ? { ok: false, error: `送信に失敗しました: ${r.error ?? ""}` } : { ok: true };
}
