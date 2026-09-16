-- ============================================================
-- 035_update_workflow_selfish_step.sql
-- 加盟店申請ワークフロー seq10「セルフィッシュへ支払先を登録」のガイド文を、
-- QOLC の「Selfish登録」ダイアログ（/admin/merchants）経由の手順へ差し替える。
--   - 旧文の「支払先番号 JCB 9桁 / セゾン 加盟店No.」は Selfish の実装と食い違う
--     （Selfish の明細突合キーは店子の加盟店番号: JCB 14桁 / セゾン 加盟店No.7桁+店舗No.7桁）
--   - src/lib/workflow/seeds.ts と migration 030 のシードも同文へ更新済み
--     （tests/workflow/seeds.test.ts が一致を検証）
-- 既に起票済みの workflow_run_steps（スナップショット）は変更しない。
-- 冪等（再実行可）。CLI未リンクのため SQL Editor 手動適用が前提。
-- ============================================================
UPDATE public.workflow_templates
SET steps = (
  SELECT jsonb_agg(
    CASE WHEN (s->>'seq')::int = 10
         THEN $json${"seq": 10, "title": "セルフィッシュへ支払先を登録", "guide": "QOLC の加盟店管理で該当加盟店の「Selfish登録」を開き、チェックリストの不足（銀行コード・支店コード・全銀カナ名義・料率適用開始日は申請詳細のUD追記情報で入力）を解消してから「Selfish へ登録」を押す。連携未設定時は登録票を見ながら Selfish で 法人→店舗→振込口座→加盟店番号→料率 の順に手動登録する。Selfish の明細突合キーは店子の加盟店番号（JCB 14桁・セゾンは加盟店No.7桁+店舗No.7桁）で、CSVファイル名の支払先番号ではない。完了条件: 登録結果（created/updated）が案件のタイムラインに記録されていること。", "external_url": "/admin/merchants", "external_label": "加盟店管理を開く"}$json$::jsonb
         ELSE s
    END
    ORDER BY (s->>'seq')::int
  )
  FROM jsonb_array_elements(steps) AS s
)
WHERE code = 'merchant_application';
