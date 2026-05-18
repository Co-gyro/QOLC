/**
 * RLS ポリシー存在検証テスト
 *
 * 011_create_rls_policies.sql を読み、全テーブルに RLS が ENABLE され、
 * かつ各ロール向けのポリシーが存在することを正規表現で検証する。
 *
 * 実DB接続テストは tests/unit/rls/live-rls.test.ts に分離（RLS_LIVE=1 で起動）。
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_PATH = join(
  __dirname,
  "../../../supabase/migrations/011_create_rls_policies.sql"
);

const REQUIRED_TABLES = [
  "facility_groups",
  "facilities",
  "profiles",
  "residents",
  "resident_accounts",
  "merchants",
  "merchant_applications",
  "facility_merchant_relations",
  "upload_formats",
  "upload_batches",
  "statement_lines",
  "payments",
  "payment_audit_logs",
  "receipts",
  "notifications",
  "mall_code_pool",
  "terminal_id_pool",
];

describe("RLS migration: 011_create_rls_policies.sql", () => {
  let sql = "";

  beforeAll(() => {
    sql = readFileSync(MIGRATION_PATH, "utf-8");
  });

  it.each(REQUIRED_TABLES)(
    "テーブル %s に RLS が有効化されている",
    (table) => {
      const pattern = new RegExp(
        `ALTER TABLE\\s+public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`,
        "i"
      );
      expect(sql).toMatch(pattern);
    }
  );

  it("admin 用ポリシーが各テーブルに存在する（最低1件）", () => {
    // 重要テーブル（admin が ALL アクセスを必要とするもの）
    const adminTables = [
      "facilities",
      "merchants",
      "payments",
      "residents",
    ];
    for (const t of adminTables) {
      const pattern = new RegExp(
        `CREATE POLICY[\\s\\S]*?ON\\s+public\\.${t}[\\s\\S]*?is_admin\\(\\)`,
        "i"
      );
      expect(sql, `admin ポリシーが ${t} にない`).toMatch(pattern);
    }
  });

  it("facility_staff 用ポリシーが residents / payments にある", () => {
    expect(sql).toMatch(/jwt_role\(\)\s*=\s*'facility_staff'/);
    expect(sql).toMatch(/p_residents_facility_staff/);
    expect(sql).toMatch(/p_payments_facility_staff_read/);
  });

  it("provider 用ポリシーが statement_lines / payments にある", () => {
    expect(sql).toMatch(/jwt_role\(\)\s*=\s*'provider'/);
    expect(sql).toMatch(/p_statement_lines_provider_read/);
    expect(sql).toMatch(/p_payments_provider_read/);
  });

  it("family 用ポリシーが payments / receipts にある", () => {
    expect(sql).toMatch(/jwt_role\(\)\s*=\s*'family'/);
    expect(sql).toMatch(/p_payments_family_read/);
    expect(sql).toMatch(/p_receipts_family_read/);
  });

  it("payment_audit_logs に DELETE 権限を剥奪するREVOKEがある", () => {
    expect(sql).toMatch(
      /REVOKE\s+DELETE\s+ON\s+public\.payment_audit_logs/i
    );
  });

  it("JWT クレーム取得ヘルパー関数が定義されている", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.jwt_role/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.jwt_facility_id/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.jwt_merchant_id/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.is_admin/);
  });
});
