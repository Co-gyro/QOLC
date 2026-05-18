-- ============================================================
-- 008_create_receipt_tables.sql
-- 領収書（決済単位で生成され、Supabase Storage に PDF を保存）
-- ============================================================

CREATE TABLE public.receipts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id    UUID NOT NULL REFERENCES public.payments(id),
  resident_id   UUID NOT NULL REFERENCES public.residents(id),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  pdf_path      TEXT,                              -- Storage パス（receipts/{year}/{month}/{uuid}.pdf 等）
  issued_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
