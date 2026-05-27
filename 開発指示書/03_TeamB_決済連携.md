# Team B: 決済連携（USEN PSP API）— 指示書

**担当**: USEN PSP API クライアント実装、決済フロー、HMAC署名
**ブランチ**: `feat/payment-*`
**依存**: Team A の Task A-2（DBスキーマ）完了後に統合部分に着手。HMAC等のロジック単体は先行開発可

---

## CLAUDE.md を必ず最初に読むこと

---

## 参考資料（必ず事前に読むこと）
- `04_USEN/会員ID決済IF仕様書*.pdf`（会員ID決済APIの全仕様）
- `QOLC_要件整理_未決定事項一覧.md` セクション11（決済API仕様）

---

## Task B-1: HMAC署名モジュール

```
USEN PSP APIの HMAC 署名モジュールを作成してください。

【ファイル】 src/lib/payment/hmac.ts

【仕様】
USEN PSP は2種類のHMAC署名を使い分ける:

1. EC決済API（カード登録）: HMAC-SHA256
   - 署名対象: リクエストパラメータを特定の順序で連結した文字列
   - キー: S203.NMK（64バイトバイナリ）をそのまま使用

2. 会員ID決済API（定常決済）: HMAC-MD5
   - 署名対象: 同上
   - キー: 同じ S203.NMK だがアルゴリズムが MD5

【実装】
- HMACキーはファイルから読み込む（パスは環境変数 USEN_HMAC_KEY_PATH）
- キーはアプリ起動時に1回だけ読み込みメモリに保持
- 署名対象文字列の組み立てはAPI仕様書に従う
- テスト環境と本番環境でキーファイルが異なるため、環境変数で切り替え

【セキュリティ】
- HMACキーファイルは .gitignore に追加済み（*.NMK）
- ログにキーの値を出力しないこと
- 署名計算に使用する一時変数はスコープを限定すること

【テスト】
- テスト用の固定キーを使ったHMAC計算テスト（SHA256, MD5 両方）
- 空文字列、日本語文字列、特殊文字を含む署名対象でのテスト
- キーファイルが存在しない場合のエラーハンドリングテスト
```

---

## Task B-2: EC決済API クライアント（カード登録用）

```
USEN PSP の EC決済API（トークン式）クライアントを実装してください。

【ファイル】 src/lib/payment/token-api.ts

【用途】 新規カード登録（3Dセキュア必須）

【主要エンドポイント】
- POST /i/token/init — カード登録開始（1円与信、3DS必須）
- POST /i/pay — 決済実行
- GET /i/result — 結果取得

【カード登録フロー】
1. QOLCサーバーが /i/token/init を呼び出し
   - site_cd, mall_cd, jutyu_cd（取引番号）, amount=1（1円与信）
   - 3DS必須パラメータを含める
   - HMAC-SHA256 署名を付与
2. レスポンスでリダイレクトURLを受け取る
3. ユーザーのブラウザをUSENの決済画面にリダイレクト
4. ユーザーがカード情報を入力（QOLCはカード番号に触れない）
5. 3Dセキュア認証
6. USENからQOLCのコールバックURLにリダイレクト
7. QOLCサーバーが /i/result で結果を取得
8. 成功 → member_id でUSENに会員登録（/member/entrybyjutyucd）
9. 1円与信を即座に取消（/auth/void）

【実装】
- 各APIコールをラップする関数を作成
- リクエスト/レスポンスの型を定義
- すべてのAPI呼び出しを payment_audit_logs に記録
- エラー時のリトライは行わない（決済は冪等性が保証されないため）

【テスト】
- HMAC署名が正しく生成されることの検証
- APIレスポンスのパース処理テスト（正常系・エラー系）
- モック使用でのフロー全体テスト
```

---

## Task B-3: 会員ID決済API クライアント（定常決済用）

```
USEN PSP の会員ID決済API クライアントを実装してください。

【ファイル】 src/lib/payment/member-api.ts

【用途】 登録済みカードでの決済（QOLCの核心機能）

【主要エンドポイント】
- /member/authbymemberid — 会員IDで与信取得（3DS不要）★メイン
- /member/entrybyjutyucd — 取引経由で会員登録
- /member/get — 会員情報取得
- /member/inactivate — 会員無効化
- /member/activate — 会員有効化
- /member/delete — 会員削除
- /sales/salesadd — 売上計上
- /sales/salescancel — 売上取消
- /sales/salesreturn — 返金
- /auth/void — 与信取消
- /auth/change — 金額変更
- /search/trade — 取引照会

【定常決済フロー】
1. QOLCが payment レコードを作成（status: pending）
2. /member/authbymemberid で与信取得
   - member_id: resident_accounts.usen_member_id
   - amount: payment.total_amount
   - mall_cd: 加盟店のモールコード
   - jutyu_cd: [mall_cd]-[7桁連番]
   - HMAC-MD5 署名
3. 成功 → status: authorized, usen_transaction_id を保存
4. /sales/salesadd で売上計上
5. 成功 → status: captured

【jutyu_cd（受注コード）の採番】
- 形式: [mall_cd]-[7桁連番]（例: A300-0000001）
- DB でシーケンスを使って一意に採番
- mall_cd はPayment の merchant に紐づくモールコード

【エラーハンドリング】
- API のレスポンスコードに応じた処理分岐
- 与信失敗 → status: failed, error_message にUSENのエラーコード保存
- 通信エラー → status: failed,手動対応フラグを立てる
- タイムアウト → /search/trade で取引状態を確認してからリトライ判断

【監査ログ】
- すべてのAPI呼び出しの request_body / response_body を payment_audit_logs に記録
- カード番号等の機密情報はレスポンスに含まれないが、念のためマスキング処理を入れる
- ip_address はリクエスト元のIPを記録

【テスト】
- 各API関数のユニットテスト（モックAPIレスポンス使用）
- jutyu_cd の採番テスト（並行実行での一意性確認）
- エラーケースの網羅テスト
- 監査ログ書き込みテスト
```

---

## Task B-4: 決済処理サービス（統合レイヤー）

```
アップロードされた明細から決済を実行する統合サービスを実装してください。

【ファイル】 src/lib/payment/payment-service.ts

【処理フロー】
1. UploadBatch の StatementLine を取得
2. 入居者 × 提供者 でグルーピング → Payment レコード作成
3. 各 Payment について:
   a. 支払いオーナーの resident_account を取得
   b. usen_member_id が存在するか確認
   c. 未登録 → status: 'pending'（カード未登録保留）
   d. 登録済み → authbymemberid で与信
   e. 与信成功 → salesadd で売上計上
   f. 完了 → LINE/メール通知をトリガー
4. バッチ全体の処理結果をまとめて返す

【重要ルール】
- 同じ入居者でも提供者が異なれば別の Payment（債権者が異なるため）
- 同じ提供者の同じ入居者の明細行は合算して1回の決済
- カード未登録の入居者は「未決済・保留」→カード登録後に手動で再処理

【テスト】
- 正常系: 3入居者×2提供者 → 6件のPayment作成→決済実行
- カード未登録者がいるケース
- 部分的に決済失敗するケース
- 同一入居者の明細合算テスト
```

---

## 完了条件
- [ ] HMAC-SHA256 / HMAC-MD5 の署名が正しく生成される
- [ ] テスト環境（TSJL/TSJM）でカード登録→与信→売上→取消のフルフローが動く
- [ ] すべてのAPI呼び出しが payment_audit_logs に記録される
- [ ] HMACキー・シークレットがコードにハードコードされていない
- [ ] エラーケースが適切にハンドリングされている
- [ ] ユニットテスト全通過
