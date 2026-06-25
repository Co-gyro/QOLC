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
  /** 適格請求書発行事業者 登録番号(T+13桁)。請求書/領収書のインボイス表記に使用 */
  invoice_registration_number: z
    .string()
    .trim()
    .regex(/^(T\d{13})?$/, "登録番号は T+13桁（例: T1234567890123）で入力してください")
    .max(14)
    .optional()
    .or(z.literal("")),
  /** 領収書の既定区分。空は自動判定（給付額から推定） */
  receipt_category: z
    .enum(["kaigo", "iryou", "jihi"])
    .or(z.literal(""))
    .nullable()
    .optional(),
});
export type MerchantFormValues = z.infer<typeof merchantFormSchema>;

/**
 * 入居者フォーム
 *
 * 設計方針（2026-06 改訂）:
 *  - 主キーは医療保険被保険者番号（QOLCは要介護限定でなく、富裕層65歳未満も対象のため）
 *  - 介護保険番号は任意（要介護認定後に追加）
 *  - 既存運用との互換性のため、移行期間中はどちらも空を許容（バリデーション緩め）
 *  - 月またぎの番号変更は former_insurance_numbers (JSONB) で履歴管理
 */
export const residentFormSchema = z.object({
  name_last: z.string().trim().min(1, "姓は必須です").max(50),
  name_first: z.string().trim().min(1, "名は必須です").max(50),
  name_last_kana: z.string().trim().max(50).optional().or(z.literal("")),
  name_first_kana: z.string().trim().max(50).optional().or(z.literal("")),
  // 医療保険（メイン主キー、最終的には iryou_hihokensha_bangou を必須化したい）
  iryou_hokensha_bangou: z
    .string()
    .trim()
    .max(8, "医療保険者番号は8桁以内")
    .optional()
    .or(z.literal("")),
  iryou_hihokensha_kigou: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal("")),
  iryou_hihokensha_bangou: z
    .string()
    .trim()
    .max(40, "医療被保険者番号が長すぎます")
    .optional()
    .or(z.literal("")),
  iryou_hihokensha_edaban: z
    .string()
    .trim()
    .max(10)
    .optional()
    .or(z.literal("")),
  // 介護保険（任意、要介護認定後に追加）
  kaigo_hokensha_bangou: z
    .string()
    .trim()
    .max(6, "介護保険者番号は6桁以内")
    .optional()
    .or(z.literal("")),
  insurance_number: z
    .string()
    .trim()
    .regex(/^([0-9]{1,10})?$/, "介護保険被保険者番号は数字10桁以内")
    .optional()
    .or(z.literal("")),
});
export type ResidentFormValues = z.infer<typeof residentFormSchema>;
