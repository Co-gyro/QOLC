/**
 * 施設/提供者アカウント発行 API（POST /api/admin/accounts）の入力スキーマ。
 * サーバー（route.ts）とクライアント（account-invite-dialog）で共有し、
 * 検証仕様の二重定義を避ける。
 */
import { z } from "zod";

/** 発行対象のロール（家族=family は招待フロー /invite が担うため対象外）。 */
export const ACCOUNT_ROLES = ["facility_staff", "provider"] as const;

/** 発行対象ロール。 */
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

/** ロール → ログイン先ポータルの表示名（案内メール・結果表示に使用）。 */
export const PORTAL_NAMES: Record<AccountRole, string> = {
  facility_staff: "施設ポータル",
  provider: "提供者ポータル",
};

/**
 * アカウント発行の入力。
 * - facility_staff は facilityId（所属施設）が必須
 * - provider は merchantId（所属提供者=加盟店）が必須
 */
export const accountCreateSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "メールアドレスを入力してください")
      .max(254, "メールアドレスが長すぎます")
      .email("メールアドレスの形式が正しくありません"),
    displayName: z
      .string()
      .trim()
      .min(1, "氏名（表示名）を入力してください")
      .max(50, "氏名（表示名）は50文字以内で入力してください"),
    role: z.enum(ACCOUNT_ROLES),
    facilityId: z.string().uuid("施設IDの形式が正しくありません").optional(),
    merchantId: z.string().uuid("提供者IDの形式が正しくありません").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === "facility_staff" && !v.facilityId) {
      ctx.addIssue({ code: "custom", message: "所属施設を指定してください", path: ["facilityId"] });
    }
    if (v.role === "provider" && !v.merchantId) {
      ctx.addIssue({
        code: "custom",
        message: "所属提供者（加盟店）を指定してください",
        path: ["merchantId"],
      });
    }
  });

/** アカウント発行の入力型。 */
export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
