-- ============================================================
-- APPLY_NOW_027policy_028.sql  （SQL Editor へ貼り付けて1回実行）
--
-- 本番DB(fxcgclgoopjgaopawgiw)で未適用だった2点をまとめて適用する。
-- いずれも冪等（再実行可）。CLI未リンクのため SQL Editor 手動適用が前提。
--
--   (A) migration 028: statement_lines.koufu_amount（公費負担額）
--       → 未適用だと領収書APIの全件SELECTが失敗しフォールバックに落ち、
--         公費表示だけでなく適用済み026(その他費用区分)の表示も巻き添えで欠落する。
--   (B) migration 027 後半: storage.objects の service_role 限定RLSポリシー
--       → バケット receipts は作成済。配信はAPI(service_role)経由のため必須ではないが
--         多層防御として適用推奨。
--
-- 適用後の確認: receipts 表示が026/028区分つきで出ること。
-- ============================================================

-- ---- (A) 028: 公費負担額カラム ------------------------------------------------
ALTER TABLE public.statement_lines
  ADD COLUMN IF NOT EXISTS koufu_amount INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.statement_lines.koufu_amount
  IS '公費負担額(公費請求額・円)。介護レセプトの公費請求額合計。公費なしは0';

-- ---- (B) 027: receipts バケットの service_role 限定ポリシー --------------------
-- バケット自体は作成済のはず。未作成環境のために冪等で再掲。
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS p_receipts_objects_service_all ON storage.objects;

CREATE POLICY p_receipts_objects_service_all ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'receipts')
  WITH CHECK (bucket_id = 'receipts');
