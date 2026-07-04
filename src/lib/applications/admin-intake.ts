/**
 * 管理画面からの手動起票（POST /api/admin/applications）の入力スキーマ
 *
 * 電話・窓口などフォーム外で受け付けた案件をその場でハブに記録するための
 * 検証定義。公開フォーム（/api/applications）の intake とは別契約で、
 * 連絡先の形式はゆるめ（電話受付のメモをそのまま残せる）にしている。
 */
import { z } from "zod";
import { ALL_SOURCES } from "./labels";

/** 手動起票の入力（source は6種すべて選択可） */
export const adminApplicationCreateSchema = z.object({
  source: z.enum(ALL_SOURCES as unknown as [string, ...string[]]),
  applicant_name: z
    .string()
    .trim()
    .min(1, "お名前を入力してください")
    .max(100, "お名前は100文字以内で入力してください"),
  applicant_org: z.string().trim().max(200).optional(),
  applicant_email: z
    .string()
    .trim()
    .max(254)
    .email("メールアドレスの形式が正しくありません")
    .optional()
    .or(z.literal("")),
  applicant_phone: z.string().trim().max(20, "電話番号は20文字以内で入力してください").optional(),
  message: z
    .string()
    .trim()
    .min(1, "ご用件・受付内容を入力してください")
    .max(2000, "内容は2000文字以内で入力してください"),
});

export type AdminApplicationCreateInput = z.infer<typeof adminApplicationCreateSchema>;
