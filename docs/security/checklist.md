# QOLC セキュリティチェックリスト

このチェックリストは、Team A〜D の成果物を `develop` ブランチへマージする前に **Team E（または同等のレビュアー）** が必ず確認する項目です。
1項目でも不通過なら、修正が完了するまでマージ拒否してください。

> バージョン: 1.0
> 最終更新: 2026-05-18
> 関連: `docs/security/review-procedure.md`

---

## ■ 認証・認可（CRITICAL）

| ID | 確認項目 | 確認方法 |
|---|---|---|
| AUTH-1 | すべての API Route で認証チェックが行われている | `grep -rE "auth\.getUser\(\)\|createSupabaseServerClient" src/app/api/` で全 route を確認 |
| AUTH-2 | ロールベースのアクセス制御が `middleware.ts` で実装されている | `src/middleware.ts` の `ROLE_PORTAL_MAP` を確認 |
| AUTH-3 | RLS ポリシーが全テーブルに設定されている | `supabase/migrations/011_create_rls_policies.sql` の `ENABLE ROW LEVEL SECURITY` を grep |
| AUTH-4 | RLS のテストが書かれている | `tests/unit/rls/*.test.ts` の存在確認 + 通過 |
| AUTH-5 | JWT の有効期限が適切（既定60分、refresh あり） | Supabase Dashboard の Auth 設定確認 |
| AUTH-6 | ログアウトでセッションが無効化される | `/api/auth/logout` の挙動を手動 or E2E で確認 |

## ■ 入力バリデーション（CRITICAL）

| ID | 確認項目 | 確認方法 |
|---|---|---|
| VAL-1 | API 入力が zod でバリデーションされている | `grep -rE "z\.object\(" src/app/api/` |
| VAL-2 | ファイルアップロードにサイズ・タイプ制限がある | `src/app/api/upload/route.ts` の `MAX_BYTES`, `ALLOWED_MIME`, `MAX_ROWS` |
| VAL-3 | CSV インジェクション対策（`= + - @ \t \r` の無害化） | `src/lib/upload/csv-injection.ts` + `tests/upload/csv-injection.test.ts` |
| VAL-4 | 生 SQL を使っていない | `grep -rE "supabase\.from\\\$|raw\(" src/` で raw SQL がないか |
| VAL-5 | XSS: ユーザー入力を `dangerouslySetInnerHTML` していない | `grep -r "dangerouslySetInnerHTML" src/` |

## ■ 機密情報の保護（CRITICAL）

| ID | 確認項目 | 確認方法 |
|---|---|---|
| SEC-1 | HMACキー・APIキー・シークレットがコードにハードコードされていない | `bash scripts/check-secrets.sh` |
| SEC-2 | `.env.local` が `.gitignore` に含まれている | `grep "\.env\\*\\.local" .gitignore` |
| SEC-3 | `*.NMK` ファイルが `.gitignore` に含まれている | `grep "\\*\\.NMK" .gitignore` |
| SEC-4 | エラーメッセージに機密情報が含まれていない | エラーハンドリングコードをレビュー、`process.env` を直接ログ出力していないか |
| SEC-5 | ログに HMAC キー・パスワード・カード番号が出力されていない | `grep -rE "console\\.(log\|error)" src/lib/payment/` |
| SEC-6 | カード番号を QOLC が保持していない（USEN トークン + member_id のみ） | DB スキーマで card_number カラムが存在しないこと |

## ■ 決済セキュリティ（CRITICAL）

| ID | 確認項目 | 確認方法 |
|---|---|---|
| PAY-1 | HMAC 署名（SHA256 / MD5）の生成が正しい | `tests/payment/hmac.test.ts` が通過 |
| PAY-2 | 全決済操作が `payment_audit_logs` に記録される | `src/lib/payment/audit-log.ts` の使用箇所を grep |
| PAY-3 | 監査ログは DELETE 不可（DB レベルで保証） | `011_create_rls_policies.sql` の `REVOKE DELETE ON public.payment_audit_logs` |
| PAY-4 | 決済金額はサーバーサイドで計算（クライアントから受け取らない） | `payment-service.ts` の `aggregateByResidentMerchant` |
| PAY-5 | 冪等性: `usen_jutyu_cd` でユニーク制約 | `007_create_payment_tables.sql` の `idx_payments_jutyu_cd` |
| PAY-6 | 監査ログの機密フィールド（card_no, hmac等）はマスク済み | `tests/payment/audit-log.test.ts` |

## ■ インフラ・通信

| ID | 確認項目 | 確認方法 |
|---|---|---|
| INF-1 | HTTPS のみ | Vercel 設定（Force HTTPS） |
| INF-2 | CORS 設定が許可ドメインを限定 | `next.config.*` の headers / middleware |
| INF-3 | Content-Security-Policy ヘッダーが設定されている | `next.config.*` の headers |
| INF-4 | Rate Limiting が決済API に設定されている | Vercel / Upstash で実装、または middleware |
| INF-5 | Supabase の Service Role キーがクライアントに露出していない | `grep -rE "SUPABASE_SERVICE_ROLE_KEY" src/` で server-only 利用のみ確認 |

---

## チェック実行コマンド集

```bash
# 機密情報スキャン
bash scripts/check-secrets.sh

# 型エラー
npx tsc --noEmit

# Lint
npx next lint

# テスト + カバレッジ
npx vitest run --coverage

# 依存脆弱性
npm audit --audit-level=high
```

## 不通過時の対応

1. PR にコメントで該当項目を指摘
2. 修正後、再度全項目を確認（部分修正でも全項目チェック）
3. すべて通過したら Approve
4. `docs/security/reviews/{YYYY-MM-DD}_{ブランチ名}.md` にレビュー記録を残す
