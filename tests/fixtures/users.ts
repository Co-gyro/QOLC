/**
 * テスト用ユーザーフィクスチャ
 */
import type { UserRole } from "../../src/types";

export interface UserFixture {
  id: string;
  email: string;
  role: UserRole;
  display_name: string;
  facility_id?: string;
  merchant_id?: string;
}

export const ADMIN_USER: UserFixture = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@qolc.test",
  role: "admin",
  display_name: "管理者太郎",
};

export const FACILITY_STAFF: UserFixture = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "staff@facility.test",
  role: "facility_staff",
  display_name: "施設職員",
  facility_id: "ffffffff-ffff-ffff-ffff-fffffffffff1",
};

export const PROVIDER_USER: UserFixture = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "provider@clinic.test",
  role: "provider",
  display_name: "提供者代表",
  merchant_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1",
};

export const FAMILY_USER: UserFixture = {
  id: "44444444-4444-4444-4444-444444444444",
  email: "family@example.test",
  role: "family",
  display_name: "家族花子",
};

export const ALL_TEST_USERS = [
  ADMIN_USER,
  FACILITY_STAFF,
  PROVIDER_USER,
  FAMILY_USER,
];
