/**
 * 決済処理サービス（統合レイヤー）
 *
 * UploadBatch の StatementLine を入居者×提供者で集約し、Payment レコードを作成、
 * 登録済みカード（usen_member_id）に対して与信→売上計上を実行する。
 *
 * 重要ルール:
 *   - 同じ入居者でも提供者が異なれば別Payment（債権者が異なるため）
 *   - 同提供者×同入居者の明細行は合算
 *   - カード未登録 → status: 'pending' で保留（手動再処理）
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  authByMemberId,
  salesAdd,
  nextJutyuCd,
} from "./member-api";
import { PaymentServiceError, UsenApiError } from "./errors";

export interface ProcessBatchInput {
  uploadBatchId: string;
  /** 実行者（auth.users.id、監査ログ用） */
  performedBy?: string | null;
  /** リクエストIP（監査ログ用） */
  ipAddress?: string | null;
  /** テスト用に注入可能なクライアント */
  client?: SupabaseClient;
  /** テスト用に注入可能な fetch */
  fetchImpl?: typeof fetch;
}

export interface PaymentResult {
  paymentId: string;
  residentId: string;
  merchantId: string;
  amount: number;
  status: "captured" | "authorized" | "pending" | "failed";
  errorMessage?: string;
}

export interface ProcessBatchResult {
  uploadBatchId: string;
  total: number;
  success: number;
  failed: number;
  pending: number;
  payments: PaymentResult[];
}

interface AggregatedKey {
  residentId: string;
  merchantId: string;
}

interface AggregatedGroup extends AggregatedKey {
  totalAmount: number;
  statementLineIds: string[];
}

interface StatementLineRow {
  id: string;
  resident_id: string | null;
  facility_id: string | null;
  self_pay_amount: number | null;
  amount: number | null;
}

interface MerchantInfo {
  id: string;
  mall_code: string | null;
}

interface PaymentOwnerInfo {
  residentAccountId: string;
  usenMemberId: string | null;
}

/**
 * UploadBatch 全体を処理する。
 */
export async function processBatch(
  input: ProcessBatchInput
): Promise<ProcessBatchResult> {
  const client = input.client ?? getSupabaseAdminClient();

  // 1. UploadBatch を取得（merchant_id 解決）
  const { data: batch, error: batchErr } = await client
    .from("upload_batches")
    .select("id, merchant_id, status")
    .eq("id", input.uploadBatchId)
    .single();
  if (batchErr || !batch) {
    throw new PaymentServiceError(
      "BATCH_NOT_FOUND",
      `UploadBatch が見つかりません: ${input.uploadBatchId}`
    );
  }
  const merchantId = batch.merchant_id as string;

  // 2. merchant の mall_code を取得
  const { data: merchant, error: merErr } = await client
    .from("merchants")
    .select("id, mall_code")
    .eq("id", merchantId)
    .single<MerchantInfo>();
  if (merErr || !merchant?.mall_code) {
    throw new PaymentServiceError(
      "MALL_CODE_MISSING",
      `加盟店 ${merchantId} に mall_code が設定されていません`
    );
  }

  // 3. statement_lines を取得（マッチ済みのみ）
  const { data: lines, error: linesErr } = await client
    .from("statement_lines")
    .select("id, resident_id, facility_id, self_pay_amount, amount")
    .eq("upload_batch_id", input.uploadBatchId)
    .eq("match_status", "matched")
    .not("resident_id", "is", null);
  if (linesErr) {
    throw new PaymentServiceError(
      "STATEMENT_LINES_FETCH_FAILED",
      linesErr.message
    );
  }
  const statementLines = (lines ?? []) as StatementLineRow[];

  // 4. 入居者×提供者で集約（提供者=merchantId なので、実質 resident_id 単位の合算）
  const groups = aggregateByResidentMerchant(statementLines, merchantId);

  const results: PaymentResult[] = [];

  for (const group of groups) {
    try {
      const result = await processGroup({
        client,
        group,
        merchant,
        uploadBatchId: input.uploadBatchId,
        performedBy: input.performedBy ?? null,
        ipAddress: input.ipAddress ?? null,
        fetchImpl: input.fetchImpl,
      });
      results.push(result);
    } catch (e) {
      // 1グループの失敗は他に伝搬しない
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        paymentId: "",
        residentId: group.residentId,
        merchantId: group.merchantId,
        amount: group.totalAmount,
        status: "failed",
        errorMessage: msg,
      });
    }
  }

  return {
    uploadBatchId: input.uploadBatchId,
    total: results.length,
    success: results.filter((r) => r.status === "captured").length,
    failed: results.filter((r) => r.status === "failed").length,
    pending: results.filter((r) => r.status === "pending").length,
    payments: results,
  };
}

/**
 * statement_lines を resident_id × merchant_id で集約する。
 */
export function aggregateByResidentMerchant(
  lines: StatementLineRow[],
  merchantId: string
): AggregatedGroup[] {
  const map = new Map<string, AggregatedGroup>();
  for (const line of lines) {
    if (!line.resident_id) continue;
    const amount = line.self_pay_amount ?? line.amount ?? 0;
    const key = `${line.resident_id}::${merchantId}`;
    const existing = map.get(key);
    if (existing) {
      existing.totalAmount += amount;
      existing.statementLineIds.push(line.id);
    } else {
      map.set(key, {
        residentId: line.resident_id,
        merchantId,
        totalAmount: amount,
        statementLineIds: [line.id],
      });
    }
  }
  return Array.from(map.values());
}

/** 入居者の支払いオーナー（usen_member_id 持ち）を取得 */
async function findPaymentOwner(
  client: SupabaseClient,
  residentId: string
): Promise<PaymentOwnerInfo | null> {
  const { data, error } = await client
    .from("resident_accounts")
    .select("id, usen_member_id")
    .eq("resident_id", residentId)
    .eq("is_payment_owner", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return {
    residentAccountId: data.id as string,
    usenMemberId: (data.usen_member_id as string | null) ?? null,
  };
}

/** 1グループ（1Payment）を処理する */
async function processGroup(args: {
  client: SupabaseClient;
  group: AggregatedGroup;
  merchant: MerchantInfo;
  uploadBatchId: string;
  performedBy: string | null;
  ipAddress: string | null;
  fetchImpl?: typeof fetch;
}): Promise<PaymentResult> {
  const { client, group, merchant, uploadBatchId, performedBy, ipAddress } = args;

  // 支払オーナー取得
  const owner = await findPaymentOwner(client, group.residentId);
  const hasCard = !!owner?.usenMemberId;

  // Payment レコード作成
  const initialStatus = hasCard ? "pending" : "pending";
  const { data: payment, error: payErr } = await client
    .from("payments")
    .insert({
      resident_id: group.residentId,
      merchant_id: group.merchantId,
      resident_account_id: owner?.residentAccountId ?? null,
      upload_batch_id: uploadBatchId,
      total_amount: group.totalAmount,
      payment_status: initialStatus,
    })
    .select("id")
    .single();
  if (payErr || !payment) {
    throw new PaymentServiceError(
      "PAYMENT_INSERT_FAILED",
      payErr?.message ?? "unknown"
    );
  }
  const paymentId = payment.id as string;

  // statement_lines に payment_id をひも付け
  await client
    .from("statement_lines")
    .update({ payment_id: paymentId })
    .in("id", group.statementLineIds);

  // カード未登録 → pending のまま返却
  if (!hasCard || !owner?.usenMemberId || !merchant.mall_code) {
    return {
      paymentId,
      residentId: group.residentId,
      merchantId: group.merchantId,
      amount: group.totalAmount,
      status: "pending",
      errorMessage: hasCard ? undefined : "カード未登録",
    };
  }

  // jutyu_cd 採番
  const jutyu_cd = await nextJutyuCd(merchant.mall_code);
  await client
    .from("payments")
    .update({ usen_jutyu_cd: jutyu_cd })
    .eq("id", paymentId);

  // 与信
  try {
    await authByMemberId(
      {
        member_id: owner.usenMemberId,
        amount: group.totalAmount,
        jutyu_cd,
        mall_cd: merchant.mall_code,
      },
      { paymentId, performedBy, ipAddress, fetchImpl: args.fetchImpl }
    );
    await client
      .from("payments")
      .update({
        payment_status: "authorized",
        authorized_at: new Date().toISOString(),
      })
      .eq("id", paymentId);
  } catch (e) {
    const msg = e instanceof UsenApiError ? e.message : String(e);
    await client
      .from("payments")
      .update({ payment_status: "failed", error_message: msg })
      .eq("id", paymentId);
    return {
      paymentId,
      residentId: group.residentId,
      merchantId: group.merchantId,
      amount: group.totalAmount,
      status: "failed",
      errorMessage: msg,
    };
  }

  // 売上計上
  try {
    await salesAdd(
      { jutyu_cd, amount: group.totalAmount, mall_cd: merchant.mall_code },
      { paymentId, performedBy, ipAddress, fetchImpl: args.fetchImpl }
    );
    await client
      .from("payments")
      .update({
        payment_status: "captured",
        captured_at: new Date().toISOString(),
      })
      .eq("id", paymentId);
  } catch (e) {
    const msg = e instanceof UsenApiError ? e.message : String(e);
    await client
      .from("payments")
      .update({
        payment_status: "failed",
        error_message: `売上計上失敗: ${msg}`,
      })
      .eq("id", paymentId);
    return {
      paymentId,
      residentId: group.residentId,
      merchantId: group.merchantId,
      amount: group.totalAmount,
      status: "failed",
      errorMessage: msg,
    };
  }

  return {
    paymentId,
    residentId: group.residentId,
    merchantId: group.merchantId,
    amount: group.totalAmount,
    status: "captured",
  };
}
