/**
 * 管理データ入力の zod バリデーションスキーマ
 *
 * フォーム送信前のクライアント検証に使用。DB制約・RLSと合わせて二重に守る。
 */
import { z } from "zod";

/** 施設フォーム */
export const facilityFormSchema = z.object({
  name: z.string().trim().min(1, "施設名は必須です").max(100, "施設名が長すぎます"),
  group_id: z.string().uuid().nullable().optional(),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9-]*$/, "電話番号は数字とハイフンのみ")
    .max(20)
    .optional()
    .or(z.literal("")),
  display_frequency: z.enum(["monthly", "bimonthly"]),
});
export type FacilityFormValues = z.infer<typeof facilityFormSchema>;

/** 加盟店フォーム */
export const merchantFormSchema = z.object({
  name: z.string().trim().min(1, "加盟店名は必須です").max(100),
  name_kana: z.string().trim().max(100).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9-]*$/, "電話番号は数字とハイフンのみ")
    .max(20)
    .optional()
    .or(z.literal("")),
  /** プールから自動払い出すか */
  assign_mall_code: z.boolean().optional(),
  assign_terminal_id: z.boolean().optional(),
  upload_format_id: z.string().uuid().nullable().optional(),
});
export type MerchantFormValues = z.infer<typeof merchantFormSchema>;

/** 入居者フォーム */
export const residentFormSchema = z.object({
  name_last: z.string().trim().min(1, "姓は必須です").max(50),
  name_first: z.string().trim().min(1, "名は必須です").max(50),
  name_last_kana: z.string().trim().max(50).optional().or(z.literal("")),
  name_first_kana: z.string().trim().max(50).optional().or(z.literal("")),
  insurance_number: z
    .string()
    .trim()
    .regex(/^[0-9]{1,10}$/, "被保険者番号は数字10桁以内"),
});
export type ResidentFormValues = z.infer<typeof residentFormSchema>;
