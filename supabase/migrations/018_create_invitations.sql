-- ============================================================
-- 018_create_invitations.sql
-- 家族招待テーブル
--
-- 施設が入居者ごとに招待を発行（トークン付き）。家族が招待リンクから登録し
-- resident_account が作成される。受諾は service_role の API 経由（anon はRLS対象外）。
-- ============================================================

CREATE TABLE public.invitations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id       UUID NOT NULL REFERENCES public.residents(id),
  facility_id       UUID NOT NULL REFERENCES public.facilities(id),
  token             TEXT UNIQUE NOT NULL,
  account_type      account_type NOT NULL DEFAULT 'family',
  is_payment_owner  BOOLEAN NOT NULL DEFAULT false,
  email             TEXT,                          -- 招待先メール（任意・記録用）
  expires_at        TIMESTAMPTZ NOT NULL,
  used_at           TIMESTAMPTZ,                   -- 受諾済み日時
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_invitations_resident ON public.invitations (resident_id);
CREATE INDEX idx_invitations_token ON public.invitations (token);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- admin: 全操作
CREATE POLICY p_invitations_admin_all ON public.invitations
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- facility_staff: 自施設の招待を参照/発行
CREATE POLICY p_invitations_facility_select ON public.invitations
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff' AND facility_id = public.jwt_facility_id()
  );
CREATE POLICY p_invitations_facility_insert ON public.invitations
  FOR INSERT WITH CHECK (
    public.jwt_role() = 'facility_staff' AND facility_id = public.jwt_facility_id()
  );

-- 受諾（token照合・used_at更新・resident_account作成）は service_role API で行うため
-- anon/family 向けの RLS ポリシーは設けない。
