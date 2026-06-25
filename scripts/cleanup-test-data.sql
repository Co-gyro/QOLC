-- ============================================================
-- QOLC テストデータ ソフトデリート（本番DB・要レビュー）
-- ============================================================
-- 目的: LINE疎通確認のために作った使い捨てテストエンティティを片付ける。
-- 適用: Supabase ダッシュボード → SQL Editor に貼り付けて実行（CLI未リンク）。
--
-- ⚠️ 重要な前提
--  - 物理削除は禁止。deleted_at に現在時刻をセットするソフトデリートのみ。
--  - 山田テスト / family@qolc.test 等の「継続利用するテストユーザー」は削除しない。
--    （E2E・本番疎通テストで現役のため）
--  - 下記は LINE疎通検証専用の使い捨てエンティティのみが対象。
--
-- 手順:
--  STEP 1 の SELECT を実行し、ヒットした行が「消してよい使い捨てデータ」だけか目視確認。
--  問題なければ STEP 2 の UPDATE を実行する。
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1: 対象を確認（まずこれだけ実行して中身を確認すること）
-- ------------------------------------------------------------
-- メモ上の部分ID: 施設 4346497b… / 入居者 5cedc638… / 家族 line_user_id U4f2688c…877

-- 1-a) [TEST]LINE疎通確認施設
SELECT id, name, deleted_at
FROM public.facilities
WHERE (id::text LIKE '4346497b%' OR name LIKE '%[TEST]%LINE%')
  AND deleted_at IS NULL;

-- 1-b) 入居者テスト太郎（residents は name_last / name_first 分割保持）
SELECT id, name_last, name_first, insurance_number, facility_id, deleted_at
FROM public.residents
WHERE (id::text LIKE '5cedc638%'
       OR (name_last || name_first) LIKE '%テスト太郎%')
  AND deleted_at IS NULL;

-- 1-c) 検証用LINE家族アカウント（小平健也 / profiles は display_name）
SELECT id, display_name, role, line_user_id, deleted_at
FROM public.profiles
WHERE line_user_id LIKE 'U4f2688c%'
  AND deleted_at IS NULL;

-- ------------------------------------------------------------
-- STEP 2: ソフトデリート（STEP 1 で対象を確認した後にのみ実行）
-- ------------------------------------------------------------
-- BEGIN; ... COMMIT; で囲み、件数を確認してからコミットすると安全。

-- BEGIN;

-- UPDATE public.facilities
--   SET deleted_at = now()
--   WHERE (id::text LIKE '4346497b%' OR name LIKE '%[TEST]%LINE%')
--     AND deleted_at IS NULL;

-- UPDATE public.residents
--   SET deleted_at = now()
--   WHERE (id::text LIKE '5cedc638%'
--          OR (name_last || name_first) LIKE '%テスト太郎%')
--     AND deleted_at IS NULL;

-- UPDATE public.profiles
--   SET deleted_at = now()
--   WHERE line_user_id LIKE 'U4f2688c%'
--     AND deleted_at IS NULL;

-- COMMIT;
-- ============================================================
-- 注: profiles は auth.users と1:1（id が FK・ON DELETE CASCADE）。ソフトデリートは
--     deleted_at セットのみで auth.users 側は残る。LINE紐付けだけ解除したい場合は
--     line_user_id を NULL に更新する選択肢もある（再ログイン時に再紐付け可能）。
-- ============================================================
