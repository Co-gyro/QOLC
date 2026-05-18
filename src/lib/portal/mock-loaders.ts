/**
 * モックデータローダー
 *
 * 各ポータルの画面で使うダミーデータを返す関数群。
 * Supabase 接続が完了したら、これらの関数の中身を本物のクエリに差し替える。
 */
import type { PaymentStatus } from "@/types";

export interface FacilityRow {
  id: string;
  name: string;
  residentCount: number;
  mallCode: string;
  monthlyPayment: number;
}

export interface ResidentRow {
  id: string;
  name: string;
  insuranceNumber: string;
  cardRegistered: boolean;
  ownerName: string | null;
}

export interface PaymentRow {
  id: string;
  residentName: string;
  merchantName: string;
  amount: number;
  status: PaymentStatus;
  date: string;
}

export interface MerchantRow {
  id: string;
  name: string;
  category: string;
  status: "active" | "pending" | "approved";
  facilityCount: number;
}

export interface DashboardStats {
  facilityCount: number;
  residentCount: number;
  monthlyPaymentCount: number;
  monthlyPaymentAmount: number;
  errorCount: number;
}

export async function loadAdminStats(): Promise<DashboardStats> {
  await sleep(50);
  return {
    facilityCount: 12,
    residentCount: 348,
    monthlyPaymentCount: 1284,
    monthlyPaymentAmount: 8_452_300,
    errorCount: 3,
  };
}

export async function loadFacilities(): Promise<FacilityRow[]> {
  await sleep(50);
  return [
    { id: "f1", name: "〇〇介護施設", residentCount: 42, mallCode: "A300", monthlyPayment: 1_234_500 },
    { id: "f2", name: "△△ケアホーム", residentCount: 28, mallCode: "A301", monthlyPayment: 892_300 },
    { id: "f3", name: "□□老人ホーム", residentCount: 36, mallCode: "A302", monthlyPayment: 1_089_700 },
  ];
}

export async function loadResidents(facilityId?: string): Promise<ResidentRow[]> {
  void facilityId;
  await sleep(50);
  return [
    { id: "r1", name: "田中太郎", insuranceNumber: "0000001234", cardRegistered: true, ownerName: "田中花子（妻）" },
    { id: "r2", name: "鈴木花子", insuranceNumber: "0000005678", cardRegistered: false, ownerName: null },
    { id: "r3", name: "佐藤次郎", insuranceNumber: "0000009999", cardRegistered: true, ownerName: "佐藤一郎（長男）" },
  ];
}

export async function loadPayments(): Promise<PaymentRow[]> {
  await sleep(50);
  return [
    { id: "p1", residentName: "田中太郎", merchantName: "テスト診療所", amount: 5000, status: "captured", date: "2026-05-15" },
    { id: "p2", residentName: "鈴木花子", merchantName: "テスト薬局", amount: 3000, status: "pending", date: "2026-05-15" },
    { id: "p3", residentName: "佐藤次郎", merchantName: "テスト診療所", amount: 8000, status: "failed", date: "2026-05-14" },
  ];
}

export async function loadMerchants(): Promise<MerchantRow[]> {
  await sleep(50);
  return [
    { id: "m1", name: "テスト診療所", category: "医療機関", status: "active", facilityCount: 5 },
    { id: "m2", name: "テスト薬局", category: "薬局", status: "active", facilityCount: 8 },
    { id: "m3", name: "新規申請クリニック", category: "医療機関", status: "pending", facilityCount: 0 },
  ];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
