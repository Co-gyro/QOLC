/**
 * 公開申請フォーム（/api/applications）の共有バリデーションスキーマ。
 * クライアント（フォーム）とサーバー（API Route）の双方で使用し、
 * 検証仕様の二重定義を避ける。
 */
import { z } from "zod";
import { FULL_KATAKANA_RE } from "@/lib/utils/kana";

/** フリガナ（全角カタカナ）。半角カナへの変換はシステム側で行う。 */
const katakanaSchema = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label}を入力してください`)
    .max(max, `${label}が長すぎます`)
    .regex(FULL_KATAKANA_RE, `${label}は全角カタカナで入力してください`);

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
 * 加盟店申請（qolc_merchant）は payload を merchantApplyFormSchema で全項目検証する:
 * フォーム実装の不具合等で必須項目が欠けた payload が保存されると、
 * 後工程（申請書生成）で申請がブロックされるため、受付時点で弾く。
 */
export const applicationIntakeSchema = z
  .object({
    source: applicationSourceSchema,
    applicant_name: z.string().trim().max(100).optional(),
    applicant_org: z.string().trim().max(200).optional(),
    applicant_email: emailSchema.optional(),
    applicant_phone: z.string().trim().max(13).optional(),
    message: z.string().trim().max(500).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.source !== "qolc_merchant") return;
    const result = merchantApplyFormSchema.safeParse(val.payload ?? {});
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payload"],
        message: `加盟店申請の入力内容が不足しています: ${result.error.issues[0]?.message ?? "不明"}`,
      });
    }
  });
export type ApplicationIntakeInput = z.infer<typeof applicationIntakeSchema>;

/**
 * QOLC加盟店申請フォームのベーススキーマ（項目定義・形式検証）。
 * 公開フォームは merchantApplyFormSchema（全必須＋法人番号条件）で検証し、
 * admin の申請内容編集は merchantApplyFormBaseSchema.partial()（入力済み項目のみ
 * 形式検証・段階的な入力を許容）を使う。
 */
export const merchantApplyFormBaseSchema = z.object({
  // 申請区分（介護施設向け / 一般の店舗・事業所向け）。文言の出し分けにのみ使い、
  // 以降の項目キーは共通のまま（下流の申請書生成を変えない）。
  // applyType 追加前に受け付けた申請には存在しないため optional。
  applyType: z.enum(["care", "general"]).optional(),
  corpType: z.enum(["法人", "個人事業主"]),
  corpName: z.string().trim().min(1, "法人名を入力してください").max(50),
  corpNameKana: katakanaSchema("法人名フリガナ", 50),
  corporateNumber: z.union([z.literal(""), corporateNumberSchema]),
  postalCode: postalCodeSchema,
  address: z.string().trim().min(1, "所在地を入力してください").max(60),
  phone: phoneSchema,
  repLastName: z.string().trim().min(1, "代表者の姓を入力してください").max(24),
  repFirstName: z.string().trim().min(1, "代表者の名を入力してください").max(24),
  repLastNameKana: katakanaSchema("代表者 姓フリガナ", 24),
  repFirstNameKana: katakanaSchema("代表者 名フリガナ", 24),
  repBirthdate: z.string().min(1, "代表者の生年月日を入力してください"),
  facilityName: z.string().trim().min(1, "施設名を入力してください").max(20),
  facilityNameKana: katakanaSchema("施設名フリガナ", 30),
  facilityPostalCode: postalCodeSchema,
  facilityAddress: z.string().trim().min(1, "施設所在地を入力してください").max(60),
  facilityPhone: phoneSchema,
  contactLastName: z.string().trim().min(1, "ご担当者の姓を入力してください").max(10),
  contactFirstName: z.string().trim().min(1, "ご担当者の名を入力してください").max(10),
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
  contactTime: z.enum(["いつでも", "午前中", "午後"]),
  note: z.string().trim().max(500).optional(),
  // 加盟店規約への同意。UD は包括加盟店であり新規申込店舗の審査は当社が行うため、
  // 申込時にお客様が各カード会社の加盟店規約へ同意した事実を証跡として残す。
  // agreedAt / documents はサーバー側で確定させるので、入力としては任意
  // （申込者の端末時刻や改変された値を証跡にしない）。
  termsAgreement: z.object({
    agreed: z
      .boolean()
      .refine((v) => v === true, "加盟店規約への同意が必要です"),
    agreedAt: z.string().optional(),
    documents: z
      .array(
        z.object({
          issuer: z.string(),
          title: z.string(),
          url: z.string(),
        })
      )
      .optional(),
  }),
});

/** 公開申請フォームの検証スキーマ（全必須＋法人番号の条件必須） */
export const merchantApplyFormSchema = merchantApplyFormBaseSchema
  // JCB申請書は法人（区分1）の場合に法人番号が必須。全法人には国税庁が
  // 法人番号を指定しているため、法人選択時は入力必須にして申請書作成の手戻りを防ぐ。
  .superRefine((v, ctx) => {
    if (v.corpType === "法人" && v.corporateNumber === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["corporateNumber"],
        message: "法人の場合は法人番号（13桁）を入力してください",
      });
    }
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
