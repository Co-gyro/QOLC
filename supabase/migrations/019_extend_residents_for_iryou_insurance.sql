-- 019_extend_residents_for_iryou_insurance.sql
-- 入居者の保険番号管理を、介護保険のみから 医療保険優位+介護保険任意 へ拡張
--
-- 背景:
--   QOLC は要介護限定サービスではなく、65歳未満（介護保険番号なし）も対象に含む。
--   レセプトデータは医療保険(社保/国保/後期高齢)と介護保険で形式・番号体系が完全に異なる。
--   月またぎで医療保険が切り替わる（社保↔国保等）ケースもあるため、過去番号の保持も必要。
--
-- 変更方針:
--   - 既存 insurance_number は「介護保険被保険者番号」として維持（NULL許容化）
--   - 医療保険系カラム（保険者番号/記号/被保険者番号/枝番）を新規追加
--   - 過去番号は former_insurance_numbers (JSONB配列) で保持
--   - マッチング: レセプト種別に応じて使うカラムを切替（アプリ側で実装）

BEGIN;

-- ============================================================
-- 1. 既存 insurance_number を NULL 許容化（介護保険番号は任意項目に）
-- ============================================================
ALTER TABLE public.residents
  ALTER COLUMN insurance_number DROP NOT NULL,
  ALTER COLUMN insurance_number TYPE TEXT;

COMMENT ON COLUMN public.residents.insurance_number IS
  '介護保険被保険者番号（10桁。要介護認定を受けた場合に登録、任意）。介護保険CSV のマッチングキー。';

-- ============================================================
-- 2. 介護保険者番号（任意）
-- ============================================================
ALTER TABLE public.residents
  ADD COLUMN kaigo_hokensha_bangou TEXT;

COMMENT ON COLUMN public.residents.kaigo_hokensha_bangou IS
  '介護保険者番号（市町村が採番。6桁）。';

-- ============================================================
-- 3. 医療保険系（被保険者番号は事実上必須だが、移行期間中は NULL 許容）
-- ============================================================
ALTER TABLE public.residents
  ADD COLUMN iryou_hokensha_bangou TEXT,
  ADD COLUMN iryou_hihokensha_kigou TEXT,
  ADD COLUMN iryou_hihokensha_bangou TEXT,
  ADD COLUMN iryou_hihokensha_edaban TEXT;

COMMENT ON COLUMN public.residents.iryou_hokensha_bangou IS
  '医療保険者番号（国保/健保組合/共済組合/後期高齢者医療等の保険者を識別）。';
COMMENT ON COLUMN public.residents.iryou_hihokensha_kigou IS
  '医療保険被保険者証の記号（健保組合等で使用、国保・後期高齢はNULL可）。';
COMMENT ON COLUMN public.residents.iryou_hihokensha_bangou IS
  '医療保険被保険者番号（マッチングの主キー）。';
COMMENT ON COLUMN public.residents.iryou_hihokensha_edaban IS
  '医療保険被保険者番号の枝番（健保組合等で使用、無い保険者ではNULL可）。';

-- ============================================================
-- 4. 過去の保険番号履歴（JSONB配列）
--    社保↔国保切替、転職、結婚等で被保険者番号が変わった場合、
--    過去レセプトのマッチングのため履歴を保持する。
--    配列要素例:
--      {
--        "type": "iryou" | "kaigo",
--        "hokensha_bangou": "100016",
--        "kigou":           "ま",
--        "bangou":          "717-6128",
--        "edaban":          "0",
--        "valid_until":     "2026-03-31"
--      }
-- ============================================================
ALTER TABLE public.residents
  ADD COLUMN former_insurance_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.residents.former_insurance_numbers IS
  '過去の保険番号履歴。月またぎ番号変更時の過去レセプトとのマッチングに使用。';

-- ============================================================
-- 5. インデックス整備
--    既存の介護保険番号ユニーク制約を維持しつつ、医療保険番号にもユニーク制約を追加。
-- ============================================================
DROP INDEX IF EXISTS public.idx_residents_insurance_facility;

-- 介護保険番号のユニーク制約（NULL の場合は対象外）
CREATE UNIQUE INDEX idx_residents_kaigo_facility
  ON public.residents (facility_id, insurance_number)
  WHERE deleted_at IS NULL AND insurance_number IS NOT NULL;

-- 医療保険番号のユニーク制約（保険者番号+被保険者番号、NULL は対象外）
CREATE UNIQUE INDEX idx_residents_iryou_facility
  ON public.residents (facility_id, iryou_hokensha_bangou, iryou_hihokensha_bangou)
  WHERE deleted_at IS NULL AND iryou_hihokensha_bangou IS NOT NULL;

-- 過去番号での検索用 GIN インデックス
CREATE INDEX idx_residents_former_insurance
  ON public.residents USING GIN (former_insurance_numbers);

COMMIT;

-- ============================================================
-- 注意:
--   このマイグレーション実行後、iryou_hihokensha_bangou が NULL の入居者は
--   医療保険レセプトのマッチング対象外となる。本番運用前に新規入居者登録UIで
--   医療保険番号入力を必須化し、既存テストデータには手動で値を投入すること。
-- ============================================================
