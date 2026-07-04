/**
 * 公開申請フォーム（/api/applications）の共有バリデーションスキーマ。
 * クライアント（フォーム）とサーバー（API Route）の双方で使用し、
 * 検証仕様の二重定義を避ける。
 */
import { z } from "zod";

/** 申請元。DBの application_source ENUM（029定義＋031拡張）に対応。 */
export const applicationSourceSchema = z.enum([
  "qolc_merchant",
  "jcb_consult",
  "contact",
  "support_facility",
  "support_family",
  "support_provider",
]);
export type ApplicationSource = z.infer<typeof applicationSourceSchema>;

/** メールアドレス形式（最大254文字）。 */
const emailSchema = z
  .string()
  .trim()
  .min(1, "メールアドレスを入力してください")
  .max(254, "メールアドレスが長すぎます")
  .email("メールアドレスの形式が正しくありません");

/** 電話番号形式（半角数字＋ハイフン、10〜13文字）。 */
const phoneSchema = z
  .string()
  .trim()
  .min(1, "電話番号を入力してください")
  .max(13, "電話番号が長すぎます")
  .regex(/^[0-9]{2,4}-[0-9]{2,4}-[0-9]{3,4}$/, "電話番号の形式が正しくありません（例：03-1234-5678）");

/** 郵便番号形式（3桁-4桁、ハイフンは任意）。 */
export const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{3}-?[0-9]{4}$/, "郵便番号の形式が正しくありません（例：123-4567）");

/** 法人番号（半角数字13桁）。任意項目。 */
export const corporateNumberSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{13}$/, "法人番号は半角数字13桁で入力してください");

/**
 * API受付の入力スキーマ（サーバー側で厳格検証）。
 * applicant_* と message はサイズ上限を持つ。payload は source 別の可変項目。
 */
export const applicationIntakeSchema = z.object({
  source: applicationSourceSchema,
  applicant_name: z.string().trim().max(100).optional(),
  applicant_org: z.string().trim().max(200).optional(),
  applicant_email: emailSchema.optional(),
  applicant_phone: z.string().trim().max(13).optional(),
  message: z.string().trim().max(500).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type ApplicationIntakeInput = z.infer<typeof applicationIntakeSchema>;

/**
 * QOLC加盟店申請フォームのクライアント側スキーマ（必須／形式検証）。
 * ワイヤーフレーム .apply-form の項目に対応する。
 */
export const merchantApplyFormSchema = z.object({
  corpType: z.enum(["法人", "個人事業主"]),
  corpName: z.string().trim().min(1, "法人名を入力してください").max(50),
  corporateNumber: z.union([z.literal(""), corporateNumberSchema]),
  postalCode: postalCodeSchema,
  address: z.string().trim().min(1, "所在地を入力してください").max(60),
  phone: phoneSchema,
  repLastName: z.string().trim().min(1, "代表者の姓を入力してください").max(24),
  repFirstName: z.string().trim().min(1, "代表者の名を入力してください").max(24),
  repBirthdate: z.string().min(1, "代表者の生年月日を入力してください"),
  facilityName: z.string().trim().min(1, "施設名を入力してください").max(20),
  facilityPostalCode: postalCodeSchema,
  facilityAddress: z.string().trim().min(1, "施設所在地を入力してください").max(60),
  facilityPhone: phoneSchema,
  contactLastName: z.string().trim().min(1, "ご担当者の姓を入力してください").max(10),
  contactFirstName: z.string().trim().min(1, "ご担当者の名を入力してください").max(10),
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
  contactTime: z.enum(["いつでも", "午前中", "午後"]),
  note: z.string().trim().max(500).optional(),
});
export type MerchantApplyForm = z.infer<typeof merchantApplyFormSchema>;

/**
 * 一般お問い合わせフォーム（/site/contact）のクライアント側スキーマ。
 * source='contact' の申請として /api/applications へ送信する想定
 * （applicant_name=name, applicant_org=org, message=message にマップ）。
 */
export const contactFormSchema = z.object({
  name: z.string().trim().min(1, "お名前を入力してください").max(100),
  org: z.string().trim().max(200).optional(),
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください")
    .max(254, "メールアドレスが長すぎます")
    .email("メールアドレスの形式が正しくありません"),
  phone: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .max(13, "電話番号が長すぎます")
      .regex(
        /^[0-9]{2,4}-[0-9]{2,4}-[0-9]{3,4}$/,
        "電話番号の形式が正しくありません（例：03-1234-5678）"
      ),
  ]),
  message: z
    .string()
    .trim()
    .min(1, "お問い合わせ内容を入力してください")
    .max(500, "お問い合わせ内容は500文字以内で入力してください"),
});
export type ContactForm = z.infer<typeof contactFormSchema>;
