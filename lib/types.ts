// ==========================================
// QOLC - 型定義（設計書 v2 準拠）
// ==========================================

// --- ユーザー関連 ---

export type UserRole = "admin" | "provider" | "facility" | "resident_family";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  facilityId?: string;
  providerId?: string;
  lineUserId?: string;
  createdAt: string;
  updatedAt: string;
}

// --- 介護施設 ---

export interface Facility {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  receiptSettings: {
    issueDay: number; // 発行日（1-31、0=月末）
    autoIssue: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// --- 入居者 ---

export interface Resident {
  id: string;
  facilityId: string;
  name: string;
  nameKana: string;
  birthDate: string;
  insurerNumber: string; // 被保険者番号（暗号化）
  cardTokenId?: string; // USEN PSPのカードトークンID
  createdAt: string;
  updatedAt: string;
}

// --- 家族 ---

export type NotificationPreference = "line" | "email" | "mail";

export interface Family {
  id: string;
  residentId: string;
  name: string;
  relationship: string; // 続柄
  email: string;
  phone: string;
  lineUserId?: string;
  notificationPreference: NotificationPreference;
  createdAt: string;
  updatedAt: string;
}

// --- 加盟店（= サービス提供者） ---

export type ServiceType =
  | "medical"
  | "nursing"
  | "care"
  | "dental"
  | "pharmacy"
  | "taxi"
  | "shopping"
  | "other";

export type MerchantStatus = "active" | "inactive" | "pending";

export interface Merchant {
  id: string;
  name: string;
  nameKana: string;
  representativeName: string;
  address: string;
  phone: string;
  fax?: string;
  email: string;
  businessNumber: string; // 事業所番号
  serviceType: ServiceType;
  bankInfo: BankInfo;
  contractStartDate: string;
  feeRate: number; // 手数料率
  selfishMerchantId?: string; // セルフィッシュ側のID
  status: MerchantStatus;
  facilityIds: string[]; // 関連する施設
  createdAt: string;
  updatedAt: string;
}

export interface BankInfo {
  bankName: string;
  branchName: string;
  accountType: "ordinary" | "current";
  accountNumber: string;
  accountHolder: string;
}

// --- 明細 ---

export type PaymentStatus = "pending" | "processing" | "completed" | "failed";

export interface StatementItem {
  description: string; // サービス内容
  unitCount: number; // 単位数
  unitPrice: number; // 単価
  amount: number; // 金額
}

export interface Statement {
  id: string;
  merchantId: string;
  merchantName?: string;
  residentId: string;
  residentName?: string;
  facilityId: string;
  facilityName?: string;
  serviceDate: string; // サービス提供日
  items: StatementItem[];
  totalAmount: number;
  insuranceAmount: number; // 保険適用額
  selfPayAmount: number; // 自己負担額
  paymentStatus: PaymentStatus;
  paymentDate?: string;
  usenTransactionId?: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

// --- 領収書 ---

export interface Receipt {
  id: string;
  receiptNumber: string; // 領収書番号
  residentId: string;
  residentName?: string;
  facilityId: string;
  facilityName?: string;
  merchantId: string;
  merchantName?: string;
  periodStart: string; // 対象期間開始
  periodEnd: string; // 対象期間終了
  statementIds: string[];
  totalAmount: number;
  issuedAt: string;
  pdfUrl?: string;
  downloadedAt?: string;
  createdAt: string;
}

// --- 通知 ---

export type NotificationType = "statement" | "receipt" | "system";
export type NotificationChannel = "line" | "email" | "web";
export type NotificationStatus = "pending" | "sent" | "failed";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  relatedId?: string;
  status: NotificationStatus;
  sentAt?: string;
  createdAt: string;
}

// --- API レスポンス ---

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
