# Team E: 品質・セキュリティ — 指示書

**担当**: テスト設計、セキュリティレビュー、CI/CD、他チームのコードレビュー
**ブランチ**: `feat/quality-*`
**役割**: 全チームのマージ前レビュー権限を持つ。品質ゲート不通過のコードはマージ拒否

---

## CLAUDE.md を必ず最初に読むこと

---

## Task E-1: テスト基盤の構築

```
テスト環境を構築してください。

【ユニットテスト: Vitest】
1. vitest.config.ts を作成
   - テスト対象: src/**/*.test.ts, src/**/*.test.tsx
   - カバレッジ設定: istanbul, 閾値はステートメント 80% 以上
   - 環境変数のモック設定

2. テストユーティリティ
   tests/utils/
   ├── supabase-mock.ts   ← Supabase クライアントのモック
   ├── auth-mock.ts       ← 認証状態のモック（各ロール用）
   ├── payment-mock.ts    ← USEN PSP APIレスポンスのモック
   └── render-with-providers.tsx ← テスト用ラッパー

3. テストフィクスチャ
   tests/fixtures/
   ├── users.ts           ← テスト用ユーザーデータ
   ├── facilities.ts
   ├── residents.ts
   ├── payments.ts
   ├── csv-samples/       ← テスト用CSVファイル
   └── receipt-samples/   ← テスト用レセプトデータ

【E2Eテスト: Playwright】
1. playwright.config.ts を作成
   - ブラウザ: chromium
   - baseURL: http://localhost:3000
   - スクリーンショット: テスト失敗時のみ

2. E2Eテストのシナリオ（Phase 1 最低限）:
   tests/e2e/
   ├── auth/
   │   ├── admin-login.spec.ts    ← 管理者ログイン→ダッシュボード表示
   │   ├── facility-login.spec.ts ← 施設スタッフログイン
   │   └── unauthorized.spec.ts   ← 権限なしアクセスの拒否確認
   ├── facility/
   │   ├── resident-crud.spec.ts  ← 入居者の登録・編集・一覧
   │   └── upload-flow.spec.ts    ← 明細アップロード→プレビュー→確認
   └── provider/
       └── upload-flow.spec.ts    ← 一括アップロード→マッチング→確認
```

---

## Task E-2: セキュリティレビューチェックリスト

```
以下のセキュリティチェックリストを作成し、各チームのマージ前にレビューしてください。

【ファイル】 docs/security/checklist.md

【チェック項目】

■ 認証・認可
□ すべてのAPI Routeで認証チェックが行われている
□ ロールベースのアクセス制御がミドルウェアで実装されている
□ RLSポリシーが全テーブルに設定されている
□ RLSポリシーのテストが書かれている（各ロールで想定外のデータにアクセスできないこと）
□ JWTの有効期限が適切に設定されている
□ セッションの無効化（ログアウト）が正しく動作する

■ 入力バリデーション
□ すべてのAPI入力が zod でバリデーションされている
□ ファイルアップロードにサイズ・タイプ制限がある
□ CSVデータのサニタイズ（CSVインジェクション対策）が実装されている
□ SQLインジェクション: 生SQLを使っていないこと（Supabaseクエリビルダーのみ）
□ XSS: ユーザー入力をそのままHTMLに挿入していないこと（Reactの標準エスケープで対応）

■ 機密情報の保護
□ HMACキー、APIキー、シークレットがコードにハードコードされていない
□ .env.local が .gitignore に含まれている
□ *.NMK（HMACキーファイル）が .gitignore に含まれている
□ エラーメッセージに機密情報（スタックトレース、DB構造等）が含まれていない
□ ログに機密情報が出力されていない
□ カード番号をQOLCが一切保持していないこと（USENトークンとmember_idのみ）

■ 決済セキュリティ
□ HMAC署名の生成と検証が正しく実装されている
□ すべての決済操作が payment_audit_logs に記録されている
□ 監査ログは削除不可（DELETE権限なし）
□ 決済金額が改ざんされないよう、サーバーサイドで計算している
□ 冪等性: 同じ jutyu_cd で二重決済されない仕組みがある

■ インフラ・通信
□ HTTPS のみ（HTTPリダイレクト設定）
□ CORS 設定が適切（許可ドメインを限定）
□ Content-Security-Policy ヘッダーが設定されている
□ Rate Limiting が決済APIに設定されている
□ Supabase のサービスロールキーがクライアントサイドに露出していない
```

---

## Task E-3: CI/CD パイプライン

```
GitHub Actions で CI パイプラインを構築してください。

【ファイル】 .github/workflows/ci.yml

【トリガー】
- Pull Request が develop または main に向けて作成されたとき
- develop または main への push

【ステップ】
1. Node.js 20 セットアップ
2. npm ci（依存関係インストール）
3. TypeScript 型チェック（npx tsc --noEmit）
4. ESLint（npx eslint src/ --max-warnings 0）
5. ユニットテスト（npx vitest run --coverage）
6. カバレッジ閾値チェック（80%未満で失敗）
7. npm audit（脆弱性チェック、high以上で失敗）
8. ビルド（npm run build）

【develop → main のマージ時追加ステップ】
9. E2Eテスト（Playwright）
10. Lighthouse パフォーマンスチェック

【ブランチ保護ルール】
- develop: CI通過必須、最低1レビュー承認必須
- main: CI通過必須、最低2レビュー承認必須（うち1つはTeam E）
```

---

## Task E-4: RLS テスト

```
Row Level Security ポリシーが正しく機能していることを検証するテストを作成してください。

【ファイル】 tests/unit/rls/

【テストシナリオ】

■ admin ロール
- すべてのテーブルの全データを読み取れること
- 全テーブルに書き込みできること

■ facility_staff ロール（facility_id = 'xxx'）
- 自施設の residents を読み取れること
- 他施設の residents を読み取れないこと
- 自施設の payments を読み取れること
- 他施設の payments を読み取れないこと
- facilities テーブルの他施設データを読み取れないこと

■ provider ロール（merchant_id = 'yyy'）
- FacilityMerchantRelation で紐づく施設の residents を読み取れること
- 紐づかない施設の residents を読み取れないこと
- 自分の upload_batches のみ読み書きできること

■ family ロール（user_id = 'zzz'）
- 自分の resident_account に紐づく resident のデータのみ読み取れること
- 他の resident のデータを読み取れないこと
- payments は自分の resident のものだけ読み取れること
- 書き込みはほぼ不可（カード登録のresidentAccountの更新のみ可）

【実装方法】
- Supabase の service_role でテストユーザーを作成
- 各ロールのJWTを生成
- 各JWTでSupabaseクライアントを作成
- 期待されるデータアクセスをアサーション
```

---

## Task E-5: 統合テスト前のレビュー手順

```
Team A〜D の成果物をマージする前のレビュー手順書を作成してください。

【ファイル】 docs/security/review-procedure.md

【レビューフロー】
1. PRが作成されたらTeam Eに通知
2. Team Eメンバーが以下を確認:
   a. CIが全通過しているか
   b. セキュリティチェックリスト（Task E-2）の該当項目をチェック
   c. テストカバレッジが80%以上か
   d. 型エラー・lint警告がないか
   e. 新しいAPIエンドポイントに認証チェックがあるか
   f. 新しいテーブルにRLSが設定されているか
   g. 機密情報がコードに含まれていないか
3. 問題があればPRにコメントで指摘
4. 修正確認後にApprove
5. develop にマージ

【レビュー記録】
- docs/security/ に日付付きのレビュー記録を残す
  例: docs/security/reviews/2026-05-20_feat-payment-hmac.md
```

---

## 完了条件
- [ ] Vitest + Playwright のテスト基盤が動作する
- [ ] テストモック（Supabase、Auth、Payment）が整備されている
- [ ] セキュリティチェックリストが作成されている
- [ ] CI/CDパイプラインが動作する（PR作成時に自動実行）
- [ ] RLSテストが全ロールで通過する
- [ ] レビュー手順書が作成されている
