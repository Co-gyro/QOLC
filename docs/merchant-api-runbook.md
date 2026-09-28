# 加盟店向け決済API 運用手順（AINY LIVE ほか）

接続仕様書 v1.0（2026-09-08 DD様送付）に対応する、UD の加盟店向け決済API の構成と運用手順。

## 1. 構成

| 項目 | 内容 |
|---|---|
| ベースURL | `https://app.qolc.jp/api`（テスト・本番共通。環境は資格情報で切り替わる） |
| 加盟店向けAPI | `POST /merchant/v1/checkout/sessions` / `GET /merchant/v1/payments/{payment_id}` / `GET /merchant/v1/payments?order_id=` / `GET /merchant/v1/payments?from=&to=…` |
| 決済画面 | `https://app.qolc.jp/checkout/{session_id}`（UD がホスト。iframe 埋め込み不可） |
| USEN 接続 | **トークン式EC決済API**（`/i/token/init` → 3Dセキュア → `/i/pay`、`option=capture` で即時売上）。結果は取引照会 `/search/trade` で確定 |
| 定期処理 | `/api/cron/merchant-api`（毎分）: 期限切れの確定・決済結果通知の送信と再送 |
| テーブル | `merchant_api_credentials` / `merchant_payments` / `merchant_webhook_deliveries`（migration 036） |
| 監査ログ | `payment_audit_logs`（action が `merchant_*`。`request_body.merchant_payment_id` で辿る） |

- UD はリンク式（`ec-payment-front/checkout`）ではなく**トークン式**で USEN と契約している（2026-05 古賀さん指摘）。決済画面は UD が作り、カード番号・CVV は USEN の iframe に入力される＝UD・加盟店のサーバを通らない。
- **テスト環境**＝資格情報の `environment = test`。USEN のテストモール（TSJL/TSJM、実課金なし）で動く。
- **本番環境**＝`environment = production`。加盟店の `merchants.mall_code`（DD様は **A304**）で決済する。

## 2. 状態遷移

| 状態 | いつ |
|---|---|
| created | セッション作成 |
| pending | 決済画面を開いた |
| succeeded | `/i/pay` 後の取引照会で `sales` / `sales_reserve` を確認（金額一致が条件） |
| failed | `/i/pay` が ng、取引照会で `auth_result=ng`、または本人認証（3DS）失敗 |
| cancelled | 決済画面の「購入をやめる」（`/i/pay` 要求後は受け付けない） |
| expired | `expires_at`＋60秒を過ぎた（USEN に進んでいたものは照会し、売上済みなら succeeded） |
| refunded | 取引照会で返品を確認（返金操作そのものは UD 運用。管理画面は未実装） |

- 失敗しても同じ画面で再入力できるのは、`/i/token/init` の失敗・通信エラーだけ（受注コードを振り直す）。カード会社の非承認・本人認証失敗は `failed` で確定し、加盟店側で新しい注文IDから作り直す（仕様書 第4章）。
- 状態の更新はすべて条件付き UPDATE（先取りロック）。戻り・通知・期限切れ処理が同時に走っても1回しか成立しない。

## 3. 本番に入れる環境変数（Vercel / Production）

| 変数 | 値 | 備考 |
|---|---|---|
| `MERCHANT_API_SECRET_ENC_KEY` | 32バイト乱数の base64（`openssl rand -base64 32`） | 署名鍵の暗号化用。**発行スクリプトを実行するローカルにも同じ値**を置く |
| `USEN_TEST_GROUP_ID` | テスト用 group_id（`.env.local` のコメント参照） | 本番 group_id と同じ値だと起動時に拒否する |
| `USEN_TEST_MALL_CD` | `TSJM` | |
| `USEN_TEST_SITE_HMAC_KEY_B64` | `TSJL.NMK` を base64 化した値（64バイト） | |
| `USEN_TEST_TOKEN_JS_URL` | テスト用 SDK の URL（`.env.local` コメントの開発用URL） | 未設定なら本番SDK URLを使う |
| `CRON_SECRET` | 既存 | 毎分 Cron の認証 |

本番側（`USEN_GROUP_ID` / `USEN_SITE_HMAC_KEY_B64` / `USEN_TOKEN_EC_API_BASE_URL` / `USEN_MEMBER_API_BASE_URL` / `NEXT_PUBLIC_USEN_TOKEN_JS_URL`）は既存の値をそのまま使う。env 追加後は再デプロイが必要。

## 4. 接続情報の発行

migration 036 を SQL Editor で適用したうえで:

```bash
# テスト環境
npx tsx scripts/merchant-api-credential.ts issue --merchant 08f967cb-c6ca-4a65-a435-f173fb89a5fd --env test \
  --domains <届出ドメイン(カンマ区切り)> --webhook <通知先URL>

# 一覧・再発行
npx tsx scripts/merchant-api-credential.ts list --merchant 08f967cb-c6ca-4a65-a435-f173fb89a5fd
npx tsx scripts/merchant-api-credential.ts rotate --api-merchant-id mch_test_XXXXXXXXXXXXXXXX
```

- 署名鍵（`sk_test_…`）は**発行時に一度だけ表示**される。DB には暗号文のみ。
- 届出ドメインは完全一致。サブドメインを包括する場合は `*.example.com`。テスト環境に限り `http://localhost` も許可。
- 既定値: 販売可能期間 3か月（`--max-event-months`）、`expires_in` 上限 3600秒（`--max-expires-in`）、1件あたり上限なし（USEN の上限 9,999,999円は常に適用）。
- 取引停止は `suspended_at`、鍵の失効は `revoked_at` を SQL Editor で設定する（管理画面は未実装）。

## 5. 加盟店へ渡すもの（テスト環境）

1. ベースURL `https://app.qolc.jp/api`
2. `merchant_id`（`mch_test_…`）
3. 署名鍵（**別経路**で送る。パスワード付きファイル＋パスワードは別メール等）
4. `expires_in` の上限（既定 3600秒）・販売可能期間（公演日の3か月前以降）
5. テスト用カード（下記）

### テスト用カード（USEN テストモール）

| 用途 | 番号 | 備考 |
|---|---|---|
| 正常系（3DS フリクションレス） | 4100000000000100 / CVV 123 / 08-2027 / 名義 TESTCARD | 2026-05-29 実機確認済み |
| 非承認・3DS チャレンジ・3DS 失敗 | **未入手** | USEN（npy-dev@netmove.co.jp）へ照会が必要 |

## 6. 未実装・今後

- レート制限（429）と 503 の自動切替（USEN の同時処理上限の回答待ち）
- 返金の管理画面（当面は `salesreturn` を運用で実行し、取引照会で refunded に反映）
- 決済結果通知の手動再送
