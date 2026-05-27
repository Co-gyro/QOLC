# Team A: 基盤構築 — 指示書

**担当**: データベース設計、認証、ミドルウェア、共通型定義
**ブランチ**: `feat/foundation-*`
**他チームへの影響**: 全チームがこの基盤を使うため、最優先で完了させること

---

## CLAUDE.md を必ず最初に読むこと
プロジェクトルートの `CLAUDE.md` を読んでから作業を開始してください。
技術スタック、セキュリティルール、ディレクトリ構成が記載されています。

---

## Task A-1: プロジェクト初期化 ★完了済み — スキップ

> **このタスクは既に完了しています。** 既存プロジェクトに以下が揃っています:
> - Next.js 14.2.35 (App Router) + TypeScript + Tailwind CSS
> - shadcn/ui（button, card, input, label, tabs, textarea）
> - Vitest 設定済み（vitest.config.ts）
> - Phase 0 CSV処理（src/lib/csv/）— 51テスト通過済み
> - 4ポータルのモックアップ（/, /facility, /provider, /user）
> - CSV変換ツール（/admin/csv-tools）
> - 加盟店申請フォーム（/admin/merchant-application）
>
> **追加インストールが必要なパッケージ:**
> - @supabase/supabase-js, @supabase/ssr（Supabase連携）
> - zod（バリデーション）
> - playwright（E2E テスト）
>
> **追加設定が必要:**
> - .env.local を作成（値は後で入れる）
> - .gitignore に .env.local, *.NMK（HMACキー）を追加
> - ESLint 設定で any 禁止ルールを追加
>
> **→ Task A-2 から開始してください。**

---

## Task A-2: データベーススキーマ作成

```
Supabase のマイグレーションファイルを作成してください。
以下のテーブルを定義します。すべてのテーブルに RLS を有効にしてください。

【マイグレーションファイルの順序】

001_create_enums.sql
- user_role: admin, facility_staff, provider, family
- payment_status: pending, authorized, captured, failed, cancelled, refunded
- upload_status: processing, preview, confirmed, completed, error
- match_status: matched, unmatched, ambiguous
- merchant_app_status: pending, reviewing, approved, rejected
- account_type: self, family
- notification_method: line, email, postal
- display_frequency: monthly, bimonthly

002_create_facility_tables.sql
- facility_groups (id UUID PK, name, created_at, updated_at, deleted_at)
- facilities (id UUID PK, group_id FK, name, address, phone,
    mall_code VARCHAR(4), merchant_id FK, display_frequency,
    upload_format_id FK, created_at, updated_at, deleted_at)

003_create_user_tables.sql
- profiles (id UUID PK → auth.users, role user_role, facility_id FK NULLABLE,
    merchant_id FK NULLABLE, display_name, created_at, updated_at, deleted_at)
  ※ Supabase Auth の auth.users と 1:1 で紐づく

004_create_resident_tables.sql
- residents (id UUID PK, facility_id FK NOT NULL,
    name_last, name_first, name_last_kana, name_first_kana,
    insurance_number VARCHAR(10) NOT NULL,
    created_at, updated_at, deleted_at)
  ※ insurance_number + facility_id でユニーク制約
- resident_accounts (id UUID PK, resident_id FK, user_id FK → auth.users,
    type account_type, is_payment_owner BOOLEAN DEFAULT false,
    usen_member_id VARCHAR(48),
    notification_method, created_at, updated_at, deleted_at)
  ※ 1入居者につき is_payment_owner=true は1レコードのみ（DBトリガーで制御）

005_create_merchant_tables.sql
- merchants (id UUID PK, name, name_kana, address, phone,
    upload_format_id FK,
    jcb_merchant_code_ec VARCHAR(17),
    jcb_merchant_code_recurring VARCHAR(17),
    saison_merchant_code VARCHAR(7),
    mall_code VARCHAR(4), terminal_id VARCHAR(13),
    created_at, updated_at, deleted_at)
- merchant_applications (id UUID PK, merchant_id FK,
    status merchant_app_status, applied_at, approved_at,
    notes TEXT, created_at, updated_at)
- facility_merchant_relations (id UUID PK, facility_id FK, merchant_id FK,
    status VARCHAR(20) DEFAULT 'active',
    created_at, updated_at)
  ※ facility_id + merchant_id でユニーク制約

006_create_upload_tables.sql
- upload_formats (id UUID PK, name, description,
    column_mapping JSONB NOT NULL, created_at, updated_at)
- upload_batches (id UUID PK, merchant_id FK,
    provider_type VARCHAR(20) CHECK (IN ('external_provider', 'facility_self')),
    file_name, total_rows INT, total_amount BIGINT,
    status upload_status, created_at, updated_at)
- statement_lines (id UUID PK, upload_batch_id FK,
    facility_id FK NULLABLE, resident_id FK NULLABLE,
    insurance_number VARCHAR(10),
    service_code VARCHAR(6), service_name,
    quantity INT, unit_price BIGINT, amount BIGINT,
    self_pay_amount BIGINT,
    match_status, payment_id FK NULLABLE,
    created_at, updated_at)

007_create_payment_tables.sql
- payments (id UUID PK, resident_id FK, merchant_id FK,
    resident_account_id FK, upload_batch_id FK,
    total_amount BIGINT NOT NULL,
    payment_status,
    usen_transaction_id VARCHAR(100),
    usen_jutyu_cd VARCHAR(20),
    authorized_at TIMESTAMPTZ, captured_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ, refunded_at TIMESTAMPTZ,
    error_message TEXT,
    created_at, updated_at)
- payment_audit_logs (id UUID PK, payment_id FK,
    action VARCHAR(50) NOT NULL,
    performed_by UUID FK → auth.users,
    request_body JSONB, response_body JSONB,
    ip_address INET, created_at)
  ※ 決済操作のすべてを記録する監査ログ。削除不可

008_create_receipt_tables.sql
- receipts (id UUID PK, payment_id FK, resident_id FK,
    period_start DATE, period_end DATE,
    pdf_path TEXT, issued_at TIMESTAMPTZ,
    created_at, updated_at)

009_create_notification_tables.sql
- notifications (id UUID PK, resident_account_id FK,
    type VARCHAR(50), title, body TEXT,
    sent_at TIMESTAMPTZ, read_at TIMESTAMPTZ,
    created_at)

010_create_mall_code_pool.sql
- mall_code_pool (id UUID PK, code VARCHAR(4) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'available'
      CHECK (IN ('available', 'assigned', 'retired')),
    assigned_to_merchant_id FK NULLABLE,
    assigned_at TIMESTAMPTZ, created_at)
- terminal_id_pool (id UUID PK, terminal_id VARCHAR(13) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'available',
    assigned_to_merchant_id FK NULLABLE,
    assigned_at TIMESTAMPTZ, created_at)

011_create_rls_policies.sql
- 全テーブルに ALTER TABLE ... ENABLE ROW LEVEL SECURITY
- admin ロール: すべてのテーブルに FULL ACCESS
- facility_staff: 自施設のデータのみ（profiles.facility_id = facilities.id）
- provider: FacilityMerchantRelation 経由で紐づく施設の入居者データのみ
- family: 自身の resident_account が紐づく resident のデータのみ

012_create_indexes.sql
- residents: insurance_number, facility_id
- statement_lines: upload_batch_id, insurance_number, match_status
- payments: resident_id, merchant_id, payment_status
- payment_audit_logs: payment_id, created_at
- facility_merchant_relations: facility_id, merchant_id

013_seed_mall_codes.sql
- mall_code_pool にモールコード A300〜A3ZZ（1,296件）を INSERT
- terminal_id_pool に端末識別番号 3124620001000〜3124620001999（1,000件）を INSERT

【重要】
- 金額は BIGINT（円単位の整数）で保持。DECIMAL は使わない
- すべてのテーブルに created_at DEFAULT now(), updated_at DEFAULT now()
- updated_at は UPDATE トリガーで自動更新
- 物理削除禁止。deleted_at カラムでソフトデリート
- payment_audit_logs テーブルだけは DELETE 権限を誰にも付与しない
```

---

## Task A-3: Supabase Auth 設定 + 認証ミドルウェア

```
Supabase Auth の設定と Next.js の認証ミドルウェアを実装してください。

【Supabase Auth 設定】
1. profiles テーブルと auth.users を連携するトリガーを作成
   - auth.users に INSERT されたら profiles に自動で行を作成
   - profiles.role はデフォルト 'family'（管理画面から変更）

2. JWT の custom claims に role と facility_id を含めるDB関数を作成
   CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
   RETURNS jsonb ...
   ※ Supabase の Auth Hook で設定

【middleware.ts】
1. すべてのリクエストで Supabase セッションを確認
2. 未認証ユーザーは /login にリダイレクト
3. 認証済みユーザーのロールを確認:
   - admin → /admin/* のみアクセス可
   - facility_staff → /facility/* のみ
   - provider → /provider/* のみ
   - family → /user/* のみ
   - ロールが合わないパスにアクセスしたら 403
4. /api/* はトークン検証のみ（リダイレクトしない）
5. 公開ページ（/, /login, /register, /api/webhook/*）はスキップ

【Supabase クライアント】
- src/lib/supabase/client.ts: ブラウザ用（createBrowserClient）
- src/lib/supabase/server.ts: Server Component用（createServerClient with cookies）
- src/lib/supabase/admin.ts: API Route用（service_role key、RLSバイパス）

【テスト】
- middleware のルーティングテスト（各ロールで正しいパスにアクセスできること）
- 不正なロールでのアクセス拒否テスト
- 未認証時のリダイレクトテスト
```

---

## Task A-4: 共通型定義

```
src/types/ に共通の型定義を作成してください。

【database.types.ts】
Supabase CLI で自動生成:
npx supabase gen types typescript --project-id [PROJECT_ID] > src/lib/supabase/types.ts

【共通型】
src/types/index.ts:
- UserRole = 'admin' | 'facility_staff' | 'provider' | 'family'
- PortalType = 'admin' | 'facility' | 'provider' | 'user'
- PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'cancelled' | 'refunded'
- その他 enum に対応する型

src/types/api.ts:
- ApiResponse<T> = { success: true, data: T } | { success: false, error: string }
- PaginatedResponse<T> = ApiResponse<{ items: T[], total: number, page: number, pageSize: number }>
```

---

## 完了条件
- [ ] `npm run dev` でエラーなく起動する
- [ ] Supabase にすべてのテーブルが作成されている
- [ ] RLS ポリシーが全テーブルに設定されている
- [ ] middleware.ts がロール別にルーティングを制御している
- [ ] 型定義が自動生成されている
- [ ] すべてのテストが通過する
