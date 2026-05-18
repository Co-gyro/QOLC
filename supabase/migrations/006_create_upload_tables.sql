-- ============================================================
-- 006_create_upload_tables.sql
-- アップロードフォーマット定義、アップロードバッチ、明細行
-- ============================================================

-- ============================================================
-- アップロードフォーマット（提供者ごとのCSVカラムマッピング）
-- ============================================================
CREATE TABLE public.upload_formats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  -- カラムマッピング例: {"insurance_number": "被保険者番号", "amount": "自己負担額"}
  column_mapping  JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_upload_formats_updated_at
  BEFORE UPDATE ON public.upload_formats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- facilities.upload_format_id / merchants.upload_format_id の FK 追加
ALTER TABLE public.facilities
  ADD CONSTRAINT fk_facilities_upload_format
  FOREIGN KEY (upload_format_id) REFERENCES public.upload_formats(id);

ALTER TABLE public.merchants
  ADD CONSTRAINT fk_merchants_upload_format
  FOREIGN KEY (upload_format_id) REFERENCES public.upload_formats(id);

-- ============================================================
-- アップロードバッチ（1回のCSVアップロード単位）
-- ============================================================
CREATE TABLE public.upload_batches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id    UUID NOT NULL REFERENCES public.merchants(id),
  provider_type  VARCHAR(20) NOT NULL CHECK (provider_type IN ('external_provider', 'facility_self')),
  file_name      TEXT,
  total_rows     INT NOT NULL DEFAULT 0,
  total_amount   BIGINT NOT NULL DEFAULT 0,         -- 円単位の整数
  status         upload_status NOT NULL DEFAULT 'processing',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_upload_batches_updated_at
  BEFORE UPDATE ON public.upload_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 明細行（CSVの1行 = 1レコード）
-- payment_id は 007 で FK 追加
-- ============================================================
CREATE TABLE public.statement_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_batch_id   UUID NOT NULL REFERENCES public.upload_batches(id),
  facility_id       UUID REFERENCES public.facilities(id),
  resident_id       UUID REFERENCES public.residents(id),
  insurance_number  VARCHAR(10),
  service_code      VARCHAR(6),
  service_name      TEXT,
  quantity          INT NOT NULL DEFAULT 1,
  unit_price        BIGINT NOT NULL DEFAULT 0,
  amount            BIGINT NOT NULL DEFAULT 0,
  self_pay_amount   BIGINT NOT NULL DEFAULT 0,
  match_status      match_status NOT NULL DEFAULT 'unmatched',
  payment_id        UUID,                              -- 007 で FK 追加
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_statement_lines_updated_at
  BEFORE UPDATE ON public.statement_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
