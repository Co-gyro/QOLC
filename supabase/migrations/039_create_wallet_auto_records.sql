-- ============================================================
-- 039_create_wallet_auto_records.sql
-- QOLC Wallet: 支払いの自動記録（iPhone のショートカットの自動化から、ウォレットでの支払いを受け取る）。
-- 開発指示書 09 の 6.3。⚠ 承認があるまで本番には適用しない（開発・デモ用プロジェクトのみ）。
--
-- - 端末ごとの鍵で受け付ける（鍵そのものは保存せず SHA-256 のハッシュだけを持つ）
-- - 受け取った値は、加工前の形（raw）も残す（国内のカードで何が取れるかの検証のため）
-- ============================================================

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS auto_record_key_hash TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS public.wallet_auto_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      UUID NOT NULL REFERENCES public.facilities(id),
  device_id        UUID NOT NULL REFERENCES public.devices(id),
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  merchant_name    TEXT,
  amount           INTEGER,                    -- 読み取れた場合のみ（"¥1,234" などを整数に）
  amount_text      TEXT,                       -- 届いた金額の文字列そのまま
  card_name        TEXT,                       -- ウォレットのカード名
  transaction_name TEXT,
  raw              JSONB,                      -- 届いた内容（検証用）
  declaration_id   UUID REFERENCES public.purchase_declarations(id),
  link_status      TEXT NOT NULL DEFAULT 'unlinked' CHECK (link_status IN ('linked', 'unlinked', 'ignored')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wallet_auto_records_facility_received
  ON public.wallet_auto_records (facility_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_auto_records_declaration ON public.wallet_auto_records (declaration_id);

DROP TRIGGER IF EXISTS trg_wallet_auto_records_updated_at ON public.wallet_auto_records;
CREATE TRIGGER trg_wallet_auto_records_updated_at BEFORE UPDATE ON public.wallet_auto_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.wallet_auto_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_wallet_auto_records_admin_read ON public.wallet_auto_records;
CREATE POLICY p_wallet_auto_records_admin_read ON public.wallet_auto_records
  FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS p_wallet_auto_records_facility_read ON public.wallet_auto_records;
CREATE POLICY p_wallet_auto_records_facility_read ON public.wallet_auto_records
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND facility_id = public.jwt_facility_id()
    AND deleted_at IS NULL
  );
REVOKE INSERT, UPDATE, DELETE ON public.wallet_auto_records FROM anon, authenticated;
