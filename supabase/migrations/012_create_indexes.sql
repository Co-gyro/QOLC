-- ============================================================
-- 012_create_indexes.sql
-- パフォーマンス用インデックス
-- ============================================================

-- residents
CREATE INDEX idx_residents_insurance_number ON public.residents (insurance_number);
CREATE INDEX idx_residents_facility_id     ON public.residents (facility_id);

-- statement_lines
CREATE INDEX idx_statement_lines_upload_batch_id   ON public.statement_lines (upload_batch_id);
CREATE INDEX idx_statement_lines_insurance_number  ON public.statement_lines (insurance_number);
CREATE INDEX idx_statement_lines_match_status      ON public.statement_lines (match_status);
CREATE INDEX idx_statement_lines_facility_id       ON public.statement_lines (facility_id);
CREATE INDEX idx_statement_lines_resident_id       ON public.statement_lines (resident_id);

-- payments
CREATE INDEX idx_payments_resident_id     ON public.payments (resident_id);
CREATE INDEX idx_payments_merchant_id     ON public.payments (merchant_id);
CREATE INDEX idx_payments_payment_status  ON public.payments (payment_status);
CREATE INDEX idx_payments_created_at      ON public.payments (created_at DESC);

-- payment_audit_logs
CREATE INDEX idx_payment_audit_logs_payment_id   ON public.payment_audit_logs (payment_id);
CREATE INDEX idx_payment_audit_logs_created_at   ON public.payment_audit_logs (created_at DESC);

-- facility_merchant_relations
CREATE INDEX idx_facility_merchant_relations_facility_id  ON public.facility_merchant_relations (facility_id);
CREATE INDEX idx_facility_merchant_relations_merchant_id  ON public.facility_merchant_relations (merchant_id);

-- profiles
CREATE INDEX idx_profiles_role         ON public.profiles (role);
CREATE INDEX idx_profiles_facility_id  ON public.profiles (facility_id) WHERE facility_id IS NOT NULL;
CREATE INDEX idx_profiles_merchant_id  ON public.profiles (merchant_id) WHERE merchant_id IS NOT NULL;

-- resident_accounts
CREATE INDEX idx_resident_accounts_user_id      ON public.resident_accounts (user_id);
CREATE INDEX idx_resident_accounts_resident_id  ON public.resident_accounts (resident_id);

-- upload_batches
CREATE INDEX idx_upload_batches_merchant_id  ON public.upload_batches (merchant_id);
CREATE INDEX idx_upload_batches_status       ON public.upload_batches (status);

-- notifications
CREATE INDEX idx_notifications_resident_account_id  ON public.notifications (resident_account_id);
CREATE INDEX idx_notifications_unread
  ON public.notifications (resident_account_id) WHERE read_at IS NULL;
