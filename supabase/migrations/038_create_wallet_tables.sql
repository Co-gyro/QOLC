-- ============================================================
-- 038_create_wallet_tables.sql
-- QOLC Wallet（介護施設の買い物同行・小口現金ゼロ化）のテーブル。
-- 開発指示書 09（v1.1）の 4章・12.5・15章、10（デモ版）の 4.1 に対応。
--
-- ⚠ 承認があるまで本番には適用しない（開発・デモ用プロジェクトのみ）。
--
-- 方針:
--   - 書き込みは API Route が service_role で行う（RLS をバイパス）。
--     authenticated には SELECT だけを許し、施設をまたいで見えないようにする。
--   - カード番号は保持しない（下4桁のみ）。
--   - 物理削除はしない（deleted_at）。
-- TODO(W1): staff_profiles（指定職員・PIN）、outing_requests / outing_sessions / outing_groups、wallet_alerts
-- ============================================================

-- ------------------------------------------------------------
-- 入居者管理への追加項目（09 の 15.3）。入居者の元データは residents のまま。
-- ------------------------------------------------------------
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS wallet_enabled BOOLEAN NOT NULL DEFAULT false,   -- お買い物の利用可否
  ADD COLUMN IF NOT EXISTS photo_url TEXT,                                   -- 顔写真（任意）
  ADD COLUMN IF NOT EXISTS room_label TEXT,                                  -- 居室（表示用・任意）
  ADD COLUMN IF NOT EXISTS wallet_monthly_budget INTEGER;                    -- 月次の利用の目安（任意）

-- ------------------------------------------------------------
-- 子カード台帳（下4桁のみ）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.facility_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES public.facilities(id),
  label           TEXT NOT NULL,
  last4           CHAR(4) NOT NULL CHECK (last4 ~ '^[0-9]{4}$'),
  brand           TEXT,
  credential_type TEXT NOT NULL DEFAULT 'physical' CHECK (credential_type IN ('physical', 'apple_pay')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lost', 'retired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_facility_cards_facility ON public.facility_cards (facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_cards_last4 ON public.facility_cards (last4) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 共用端末（最小限）。TODO(W1): 端末登録・失効
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id  UUID NOT NULL REFERENCES public.facilities(id),
  name         TEXT NOT NULL,
  card_id      UUID REFERENCES public.facility_cards(id),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_devices_facility ON public.devices (facility_id);

-- ------------------------------------------------------------
-- 利用者宣言（1回の支払い＝入居者1人分）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_declarations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES public.facilities(id),
  resident_id     UUID NOT NULL REFERENCES public.residents(id),
  staff_user_id   UUID REFERENCES auth.users(id),          -- 操作したアカウント（TODO(W1): 職員プロファイル）
  device_id       UUID REFERENCES public.devices(id),
  card_id         UUID REFERENCES public.facility_cards(id),
  status          TEXT NOT NULL DEFAULT 'selecting' CHECK (status IN (
                    'selecting', 'awaiting_receipt', 'declared', 'matched', 'mismatched',
                    'confirmed', 'reconciled', 'needs_review', 'cancelled')),
  payment_method  TEXT NOT NULL DEFAULT 'apple_pay' CHECK (payment_method IN ('apple_pay', 'physical_card')),
  selected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at         TIMESTAMPTZ,
  amount          INTEGER CHECK (amount IS NULL OR amount > 0),
  entered_amount  INTEGER CHECK (entered_amount IS NULL OR entered_amount > 0),
  merchant_name   TEXT,
  printed_at      TIMESTAMPTZ,
  auto_amount         INTEGER,                              -- 支払いの自動記録（Phase W2）
  auto_merchant_name  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_purchase_declarations_facility_selected
  ON public.purchase_declarations (facility_id, selected_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_declarations_resident ON public.purchase_declarations (resident_id);
CREATE INDEX IF NOT EXISTS idx_purchase_declarations_status ON public.purchase_declarations (status);

-- ------------------------------------------------------------
-- レシート（1宣言に1件。返品レシートは TODO(W1)）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipt_images (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id        UUID NOT NULL REFERENCES public.facilities(id),
  declaration_id     UUID NOT NULL REFERENCES public.purchase_declarations(id),
  storage_path       TEXT NOT NULL,
  ocr_merchant_name  TEXT,
  ocr_printed_at     TIMESTAMPTZ,
  ocr_amount         INTEGER,
  ocr_confidence     NUMERIC(3, 2),
  ocr_items          JSONB,
  ocr_payment_label  TEXT,
  ocr_card_last4     CHAR(4) CHECK (ocr_card_last4 IS NULL OR ocr_card_last4 ~ '^[0-9]{4}$'),
  captured_at        TIMESTAMPTZ,
  created_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_images_one_per_declaration
  ON public.receipt_images (declaration_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receipt_images_facility ON public.receipt_images (facility_id);

-- ------------------------------------------------------------
-- カード明細の取込（運営センターで一括。1ファイルに複数施設・複数カードが混在しうる）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.card_statement_imports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     TEXT NOT NULL,
  target_month  CHAR(6),                                   -- 請求月 YYYYMM
  line_count    INTEGER NOT NULL DEFAULT 0,
  imported_by   UUID REFERENCES auth.users(id),
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reconciled_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.card_statement_lines (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id          UUID NOT NULL REFERENCES public.card_statement_imports(id),
  line_no            INTEGER NOT NULL,
  facility_id        UUID REFERENCES public.facilities(id),   -- 下4桁から特定（特定できなければ NULL）
  card_id            UUID REFERENCES public.facility_cards(id),
  card_last4         CHAR(4),
  target_month       CHAR(6),
  usage_date         DATE,
  usage_time         TIME,                                    -- アプラスの明細には無い（将来用）
  merchant_name      TEXT,
  amount             INTEGER,
  sales_type         TEXT,
  installment_count  TEXT,
  installment_no     TEXT,
  payment_amount     INTEGER,
  note               TEXT,
  is_reference       BOOLEAN NOT NULL DEFAULT false,          -- 手数料など利用明細でない行
  declaration_id     UUID REFERENCES public.purchase_declarations(id),
  match_status       TEXT NOT NULL DEFAULT 'unmatched'
                       CHECK (match_status IN ('unmatched', 'matched', 'needs_review', 'excluded')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_card_statement_lines_import ON public.card_statement_lines (import_id);
CREATE INDEX IF NOT EXISTS idx_card_statement_lines_facility ON public.card_statement_lines (facility_id);

-- ------------------------------------------------------------
-- updated_at トリガー
-- ------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['facility_cards', 'devices', 'purchase_declarations', 'receipt_images',
                           'card_statement_imports', 'card_statement_lines']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- RLS: admin は全件、facility_staff は自施設の SELECT のみ。書き込みは service_role（API）だけ。
-- ------------------------------------------------------------
ALTER TABLE public.facility_cards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_declarations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_images          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_statement_imports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_statement_lines    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['facility_cards', 'devices', 'purchase_declarations', 'receipt_images', 'card_statement_lines']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS p_%1$s_admin_read ON public.%1$s', t);
    EXECUTE format('CREATE POLICY p_%1$s_admin_read ON public.%1$s FOR SELECT USING (public.is_admin())', t);
    EXECUTE format('DROP POLICY IF EXISTS p_%1$s_facility_read ON public.%1$s', t);
    EXECUTE format('CREATE POLICY p_%1$s_facility_read ON public.%1$s FOR SELECT USING (
                      public.jwt_role() = ''facility_staff''
                      AND facility_id IS NOT NULL
                      AND facility_id = public.jwt_facility_id()
                      AND deleted_at IS NULL)', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%1$s FROM anon, authenticated', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS p_card_statement_imports_admin_read ON public.card_statement_imports;
CREATE POLICY p_card_statement_imports_admin_read ON public.card_statement_imports
  FOR SELECT USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.card_statement_imports FROM anon, authenticated;

-- ------------------------------------------------------------
-- レシート画像の Storage バケット（027 の receipts にならう。非公開・service_role のみ）
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('wallet-receipts', 'wallet-receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS p_wallet_receipts_objects_service_all ON storage.objects;
CREATE POLICY p_wallet_receipts_objects_service_all ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'wallet-receipts')
  WITH CHECK (bucket_id = 'wallet-receipts');
