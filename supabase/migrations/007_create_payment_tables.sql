-- ============================================================
-- 007_create_payment_tables.sql
-- 決済・決済監査ログ
-- ============================================================

-- ============================================================
-- 決済（入居者×提供者×バッチ単位）
-- ============================================================
CREATE TABLE public.payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id           UUID NOT NULL REFERENCES public.residents(id),
  merchant_id           UUID NOT NULL REFERENCES public.merchants(id),
  resident_account_id   UUID REFERENCES public.resident_accounts(id),
  upload_batch_id       UUID REFERENCES public.upload_batches(id),
  total_amount          BIGINT NOT NULL,
  payment_status        payment_status NOT NULL DEFAULT 'pending',
  usen_transaction_id   VARCHAR(100),
  usen_jutyu_cd         VARCHAR(20),                   -- USEN受注コード（モールごとに連番）
  authorized_at         TIMESTAMPTZ,
  captured_at           TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  refunded_at           TIMESTAMPTZ,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- jutyu_cd の二重決済防止
CREATE UNIQUE INDEX idx_payments_jutyu_cd
  ON public.payments (usen_jutyu_cd)
  WHERE usen_jutyu_cd IS NOT NULL;

-- statement_lines.payment_id の FK 追加
ALTER TABLE public.statement_lines
  ADD CONSTRAINT fk_statement_lines_payment
  FOREIGN KEY (payment_id) REFERENCES public.payments(id);

-- ============================================================
-- 決済監査ログ（決済関連の全操作を記録）
-- DELETE 権限は誰にも与えない（011 で対応）
-- ============================================================
CREATE TABLE public.payment_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      UUID REFERENCES public.payments(id),
  action          VARCHAR(50) NOT NULL,         -- 例: 'auth_request', 'sales_add', 'void'
  performed_by    UUID REFERENCES auth.users(id),
  request_body    JSONB,
  response_body   JSONB,
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- mall_cd ごとの jutyu_cd 連番採番用シーケンス
-- 形式: [mall_cd]-[7桁連番]
-- ============================================================
CREATE TABLE public.jutyu_cd_counters (
  mall_cd       VARCHAR(4) PRIMARY KEY,
  next_value    BIGINT NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 採番関数（FOR UPDATE で行ロック、並行採番でも一意性確保）
CREATE OR REPLACE FUNCTION public.next_jutyu_cd(p_mall_cd VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  INSERT INTO public.jutyu_cd_counters (mall_cd, next_value)
  VALUES (p_mall_cd, 1)
  ON CONFLICT (mall_cd) DO NOTHING;

  UPDATE public.jutyu_cd_counters
  SET next_value = next_value + 1,
      updated_at = now()
  WHERE mall_cd = p_mall_cd
  RETURNING next_value - 1 INTO v_next;

  RETURN p_mall_cd || '-' || LPAD(v_next::TEXT, 7, '0');
END;
$$;
