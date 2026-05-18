/**
 * QOLC 共通型定義
 *
 * DB ENUM と1対1で対応する union 型を定義する。
 * （database.types.ts は Supabase CLI で自動生成して別途配置）
 */

export type UserRole = "admin" | "facility_staff" | "provider" | "family";

export type PortalType = "admin" | "facility" | "provider" | "user";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "refunded";

export type UploadStatus =
  | "processing"
  | "preview"
  | "confirmed"
  | "completed"
  | "error";

export type MatchStatus = "matched" | "unmatched" | "ambiguous";

export type MerchantAppStatus =
  | "pending"
  | "reviewing"
  | "approved"
  | "rejected";

export type AccountType = "self" | "family";

export type NotificationMethod = "line" | "email" | "postal";

export type DisplayFrequency = "monthly" | "bimonthly";

/** JWT の app_metadata に埋め込まれるカスタムクレーム */
export interface AppMetadataClaims {
  role?: UserRole;
  facility_id?: string;
  merchant_id?: string;
}
