-- ============================================================
-- 004_create_resident_tables.sql
-- 入居者・入居者アカウント
-- ============================================================

CREATE TABLE public.residents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id       UUID NOT NULL REFERENCES public.facilities(id),
  name_last         TEXT NOT NULL,
  name_first        TEXT NOT NULL,
  name_last_kana    TEXT,
  name_first_kana   TEXT,
  insurance_number  VARCHAR(10) NOT NULL,        -- 被保険者番号（マッチングキー）
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE TRIGGER trg_residents_updated_at
  BEFORE UPDATE ON public.residents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 同一施設内で被保険者番号の重複を許さない（論理削除を除く）
CREATE UNIQUE INDEX idx_residents_insurance_facility
  ON public.residents (facility_id, insurance_number)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 入居者アカウント（入居者本人 or 家族のログインアカウント）
-- ============================================================
CREATE TABLE public.resident_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id           UUID NOT NULL REFERENCES public.residents(id),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                  account_type NOT NULL,
  is_payment_owner      BOOLEAN NOT NULL DEFAULT false,
  usen_member_id        VARCHAR(48),               -- USEN PSP 会員ID（カード登録後に設定）
  notification_method   notification_method NOT NULL DEFAULT 'email',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE TRIGGER trg_resident_accounts_updated_at
  BEFORE UPDATE ON public.resident_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 同じユーザーが同じ入居者に複数アカウントを持たない
CREATE UNIQUE INDEX idx_resident_accounts_user_resident
  ON public.resident_accounts (resident_id, user_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 1入居者につき is_payment_owner=true は1レコードのみ（部分ユニーク制約）
-- ============================================================
CREATE UNIQUE INDEX idx_resident_accounts_one_payment_owner
  ON public.resident_accounts (resident_id)
  WHERE is_payment_owner = true AND deleted_at IS NULL;
