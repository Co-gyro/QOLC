-- ============================================================
-- 002_create_facility_tables.sql
-- 介護施設グループ・介護施設テーブル
-- ============================================================

-- updated_at 自動更新トリガー関数（プロジェクト全体で使用）
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 介護施設グループ（運営法人単位）
-- ============================================================
CREATE TABLE public.facility_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER trg_facility_groups_updated_at
  BEFORE UPDATE ON public.facility_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 介護施設
-- ============================================================
-- merchant_id / upload_format_id は後続の005, 006で外部キー制約を追加
CREATE TABLE public.facilities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID REFERENCES public.facility_groups(id),
  name                TEXT NOT NULL,
  address             TEXT,
  phone               TEXT,
  mall_code           VARCHAR(4),                  -- USEN PSP モールコード
  merchant_id         UUID,                        -- 紐づく加盟店（005で FK 追加）
  display_frequency   display_frequency NOT NULL DEFAULT 'monthly',
  upload_format_id    UUID,                        -- 明細フォーマット（006で FK 追加）
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE TRIGGER trg_facilities_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- モールコード（assigned 状態のもの）の一意性
CREATE UNIQUE INDEX idx_facilities_mall_code
  ON public.facilities (mall_code)
  WHERE mall_code IS NOT NULL AND deleted_at IS NULL;
