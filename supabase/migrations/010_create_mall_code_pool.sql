-- ============================================================
-- 010_create_mall_code_pool.sql
-- USEN PSP モールコードプール・端末識別番号プール
-- 加盟店申請時にここから払い出す
-- ============================================================

CREATE TABLE public.mall_code_pool (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        VARCHAR(4) UNIQUE NOT NULL,
  status                      VARCHAR(20) NOT NULL DEFAULT 'available'
                              CHECK (status IN ('available', 'assigned', 'retired')),
  assigned_to_merchant_id     UUID REFERENCES public.merchants(id),
  assigned_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mall_code_pool_status ON public.mall_code_pool (status);

CREATE TABLE public.terminal_id_pool (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id                 VARCHAR(13) UNIQUE NOT NULL,
  status                      VARCHAR(20) NOT NULL DEFAULT 'available'
                              CHECK (status IN ('available', 'assigned', 'retired')),
  assigned_to_merchant_id     UUID REFERENCES public.merchants(id),
  assigned_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_terminal_id_pool_status ON public.terminal_id_pool (status);
