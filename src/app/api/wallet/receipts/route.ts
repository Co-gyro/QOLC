/**
 * POST /api/wallet/receipts（multipart/form-data）
 * レシートの画像と読み取り結果を登録し、記録と照らし合わせる（第1段階）。
 * 外れた場合も保存し、記録を要確認（mismatched）にして警告を返す。
 */
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/audit/activity-log";
import { authorizeWalletStaff, walletError } from "@/lib/wallet/auth";
import {
  DECLARATION_SELECT, type DeclarationRow, WALLET_RECEIPT_BUCKET, activeReceipt, loadDeclaration,
  receiptItemSchema, signedImageUrl, toDto,
} from "@/lib/wallet/declarations";
import { checkReceipt } from "@/lib/wallet/receipt-check";
import { apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/heic"];

const optionalText = z.string().trim().max(200).optional().transform((v) => (v ? v : null));
const optionalInt = z.coerce.number().int().optional();
const fieldsSchema = z.object({
  declaration_id: z.string().uuid(),
  amount: z.coerce.number().int().min(1).max(1_000_000),
  merchant_name: optionalText,
  printed_at: z.string().datetime({ offset: true }),
  captured_at: z.string().datetime({ offset: true }).optional(),
  ocr_merchant_name: optionalText,
  ocr_printed_at: z.string().datetime({ offset: true }).optional(),
  ocr_amount: optionalInt,
  ocr_confidence: z.coerce.number().min(0).max(1).optional(),
  ocr_payment_label: optionalText,
  ocr_card_last4: z.string().regex(/^\d{4}$/).optional(),
  ocr_items: z.string().max(20_000).optional(),
});

/** レシートを登録する */
export async function POST(req: NextRequest) {
  const staff = await authorizeWalletStaff(req);
  if ("response" in staff) return staff.response;

  const form = await req.formData().catch(() => null);
  if (!form) return walletError("送信の形式が正しくありません", "VALIDATION", 400).response;
  const image = form.get("image");
  const raw = Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string"));
  const fields = fieldsSchema.safeParse(raw);
  if (!fields.success) return walletError("入力が正しくありません", "VALIDATION", 400).response;
  if (!(image instanceof File) || !IMAGE_TYPES.includes(image.type) || image.size > MAX_IMAGE_BYTES) {
    return walletError("レシートの画像（8MB 以下の JPEG）を送ってください", "VALIDATION", 400).response;
  }
  const items = parseItems(fields.data.ocr_items);

  const f = fields.data;
  const declaration = await loadDeclaration(staff.admin, staff.facilityId, f.declaration_id);
  if (!declaration) return walletError("記録が見つかりません", "NOT_FOUND", 404).response;
  if (!["awaiting_receipt", "mismatched"].includes(declaration.status)) {
    return walletError("この記録には、いまレシートを登録できません", "CONFLICT", 409).response;
  }

  const path = `${staff.facilityId}/${declaration.id}/${randomUUID()}.jpg`;
  const upload = await staff.admin.storage
    .from(WALLET_RECEIPT_BUCKET)
    .upload(path, Buffer.from(await image.arrayBuffer()), { contentType: image.type, upsert: false });
  if (upload.error) return walletError("画像を保存できませんでした", "STORAGE_ERROR", 500).response;

  // 撮り直し（要確認からの再登録）なら、前のレシートを論理削除する
  if (activeReceipt(declaration)) {
    await staff.admin.from("receipt_images").update({ deleted_at: new Date().toISOString() })
      .eq("declaration_id", declaration.id).is("deleted_at", null);
  }
  const { data: receipt, error: receiptError } = await staff.admin.from("receipt_images").insert({
    facility_id: staff.facilityId,
    declaration_id: declaration.id,
    storage_path: path,
    ocr_merchant_name: f.ocr_merchant_name,
    ocr_printed_at: f.ocr_printed_at ?? null,
    ocr_amount: f.ocr_amount ?? null,
    ocr_confidence: f.ocr_confidence ?? null,
    ocr_items: items?.success ? items.data : null,
    ocr_payment_label: f.ocr_payment_label,
    ocr_card_last4: f.ocr_card_last4 ?? null,
    captured_at: f.captured_at ?? null,
    created_by: staff.userId,
  }).select("id").single();
  if (receiptError || !receipt) return walletError("レシートを記録できませんでした", "DB_ERROR", 500).response;

  const { data: cards } = await staff.admin.from("facility_cards").select("last4")
    .eq("facility_id", staff.facilityId).eq("status", "active").is("deleted_at", null);
  const check = checkReceipt({
    selectedAt: declaration.selected_at,
    paidAt: declaration.paid_at,
    enteredAmount: declaration.entered_amount,
    receiptAmount: f.amount,
    printedAt: f.printed_at,
    receiptCardLast4: f.ocr_card_last4 ?? null,
    facilityCardLast4s: (cards ?? []).map((c) => String(c.last4)),
  });

  const { data: updated } = await staff.admin.from("purchase_declarations")
    .update({
      amount: f.amount,
      merchant_name: f.merchant_name,
      printed_at: f.printed_at,
      status: check.ok ? "matched" : "mismatched",
    })
    .eq("id", declaration.id)
    .in("status", ["awaiting_receipt", "mismatched"])
    .select(DECLARATION_SELECT)
    .maybeSingle();
  if (!updated) return walletError("この記録は、いまの状態では変更できません", "CONFLICT", 409).response;

  const row = updated as unknown as DeclarationRow;
  await logActivity({
    actorId: staff.userId,
    facilityId: staff.facilityId,
    action: "wallet_receipt_attach",
    targetType: "purchase_declaration",
    targetId: row.id,
    targetLabel: row.residents ? `${row.residents.name_last} ${row.residents.name_first}` : null,
    metadata: { amount: f.amount, status: row.status, warnings: check.warnings },
  });
  return NextResponse.json(apiOk({
    declaration: toDto(row, await signedImageUrl(staff.admin, row)),
    receipt: { id: receipt.id },
    warnings: check.warnings,
  }));
}

/** 明細の JSON 文字列を読む。壊れていれば null */
function parseItems(raw: string | undefined) {
  if (!raw) return null;
  try {
    return z.array(receiptItemSchema).max(200).safeParse(JSON.parse(raw));
  } catch {
    return null;
  }
}
