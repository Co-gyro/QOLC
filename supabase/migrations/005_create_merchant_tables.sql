-- ============================================================
-- 005_create_merchant_tables.sql
-- 加盟店・加盟店申請・施設⇄加盟店リレーション
-- ============================================================

CREATE TABLE public.merchants (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                          TEXT NOT NULL,
  name_kana                     TEXT,
  address                       TEXT,
  phone                         TEXT,
  upload_format_id              UUID,                          -- 006 で FK 追加
  jcb_merchant_code_ec          VARCHAR(17),                   -- JCB EC加盟店番号
  jcb_merchant_code_recurring   VARCHAR(17),                   -- JCB 継続課金加盟店番号
  saison_merchant_code          VARCHAR(7),                    -- セゾン加盟店番号
  mall_code                     VARCHAR(4),                    -- USEN モールコード
  terminal_id                   VARCHAR(13),                   -- USEN 端末識別番号
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                    TIMESTAMPTZ
);

CREATE TRIGGER trg_merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX idx_merchants_mall_code
  ON public.merchants (mall_code)
  WHERE mall_code IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_merchants_terminal_id
  ON public.merchants (terminal_id)
  WHERE terminal_id IS NOT NULL AND deleted_at IS NULL;

-- facilities.merchant_id / profiles.merchant_id の FK 制約を後付けで追加
ALTER TABLE public.facilities
  ADD CONSTRAINT fk_facilities_merchant
  FOREIGN KEY (merchant_id) REFERENCES public.merchants(id);

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_merchant
  FOREIGN KEY (merchant_id) REFERENCES public.merchants(id);

-- ============================================================
-- 加盟店申請
-- ============================================================
CREATE TABLE public.merchant_applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES public.merchants(id),
  status        merchant_app_status NOT NULL DEFAULT 'pending',
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at   TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_merchant_applications_updated_at
  BEFORE UPDATE ON public.merchant_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 施設⇄加盟店リレーション
-- 1施設に複数の加盟店（医療機関、薬局など）が紐づく
-- ============================================================
CREATE TABLE public.facility_merchant_relations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id  UUID NOT NULL REFERENCES public.facilities(id),
  merchant_id  UUID NOT NULL REFERENCES public.merchants(id),
  status       VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_facility_merchant_relations_updated_at
  BEFORE UPDATE ON public.facility_merchant_relations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX idx_facility_merchant_unique
  ON public.facility_merchant_relations (facility_id, merchant_id);
