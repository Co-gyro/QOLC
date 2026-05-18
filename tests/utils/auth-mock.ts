/**
 * 認証モックユーティリティ
 *
 * テスト用に各ロールのユーザー / JWT を生成する。
 * jsonwebtoken で署名するが、Supabaseに送るわけではないのでテスト内検証用。
 */
import jwt from "jsonwebtoken";
import type { UserRole } from "../../src/types";

export interface MockUser {
  id: string;
  email: string;
  role: UserRole;
  facilityId?: string;
  merchantId?: string;
}

const TEST_SECRET = "test-jwt-secret-for-unit-tests-only";

export const MOCK_USERS: Record<UserRole, MockUser> = {
  admin: {
    id: "11111111-1111-1111-1111-111111111111",
    email: "admin@example.com",
    role: "admin",
  },
  facility_staff: {
    id: "22222222-2222-2222-2222-222222222222",
    email: "facility@example.com",
    role: "facility_staff",
    facilityId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
  },
  provider: {
    id: "33333333-3333-3333-3333-333333333333",
    email: "provider@example.com",
    role: "provider",
    merchantId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  },
  family: {
    id: "44444444-4444-4444-4444-444444444444",
    email: "family@example.com",
    role: "family",
  },
};

/**
 * 指定ロールのモックJWTを発行する（HS256, テスト用）。
 */
export function signMockJwt(user: MockUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      app_metadata: {
        role: user.role,
        facility_id: user.facilityId,
        merchant_id: user.merchantId,
      },
    },
    TEST_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );
}

/** デコードのみ（署名検証はテスト用に省略可） */
export function decodeMockJwt(token: string): unknown {
  return jwt.decode(token);
}

/** auth.getUser() 相当の結果を返すモック */
export function mockGetUser(user: MockUser | null) {
  return Promise.resolve({
    data: { user: user ? toSupabaseUser(user) : null },
    error: null,
  });
}

function toSupabaseUser(u: MockUser) {
  return {
    id: u.id,
    email: u.email,
    app_metadata: {
      role: u.role,
      facility_id: u.facilityId,
      merchant_id: u.merchantId,
    },
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };
}
