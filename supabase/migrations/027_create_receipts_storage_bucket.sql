-- ============================================================
-- 027_create_receipts_storage_bucket.sql
-- 領収書PDFの永続化先となる Storage バケット `receipts`（非公開）を作成する。
-- 受領印つきの確定領収書PDFを保存し、再発行時はこの保存物を配信する（その場再生成を廃止）。
--
-- 配信は API（service_role）経由で行い、API側でロール別認可を行う。
-- そのため公開アクセスは禁止し、storage.objects のポリシーは service_role のみ許可する。
-- ============================================================

-- バケット作成（既存ならスキップ）
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- 既存ポリシーを掃除（再実行可能にする）
DROP POLICY IF EXISTS p_receipts_objects_service_all ON storage.objects;

-- receipts バケットのオブジェクトは service_role のみ全操作可（公開・匿名は不可）
CREATE POLICY p_receipts_objects_service_all ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'receipts')
  WITH CHECK (bucket_id = 'receipts');
