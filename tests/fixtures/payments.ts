import type { PaymentStatus } from "../../src/types";

export interface PaymentFixture {
  id: string;
  resident_id: string;
  merchant_id: string;
  total_amount: number;
  payment_status: PaymentStatus;
  usen_jutyu_cd?: string;
}

export const PAYMENT_AUTHORIZED: PaymentFixture = {
  id: "11111111-aaaa-aaaa-aaaa-000000000001",
  resident_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
  merchant_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1",
  total_amount: 5000,
  payment_status: "authorized",
  usen_jutyu_cd: "A300-0000001",
};

export const PAYMENT_PENDING: PaymentFixture = {
  id: "11111111-aaaa-aaaa-aaaa-000000000002",
  resident_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
  merchant_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1",
  total_amount: 3000,
  payment_status: "pending",
};

export const PAYMENT_FAILED: PaymentFixture = {
  id: "11111111-aaaa-aaaa-aaaa-000000000003",
  resident_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
  merchant_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1",
  total_amount: 8000,
  payment_status: "failed",
};

export const PAYMENTS = [PAYMENT_AUTHORIZED, PAYMENT_PENDING, PAYMENT_FAILED];
