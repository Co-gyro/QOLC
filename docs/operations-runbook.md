# QOLC 運用Runbook（本番リリース・決済運用手順）

最終更新: 2026-06-25

本書は QOLC 本番運用での「環境切替」「Vercelデプロイ」「決済の締めサイクル」「取消/返金」「障害対応」をまとめた運用手順書。決済はリアルマネーが動くため、各操作前に**現在の環境（テスト/本番）を必ず確認**すること。

---

## 1. 環境の二面性（テスト / 本番）

USEN PSP は「テスト環境」「本番環境」が同一ホスト（`inet-uketsuke1.netmove.jp`）上に同居し、`site_cd` / `mall_cd` + HMACキー + `group_id` の組み合わせで区別される。**URLでは見分けられない**ため、env値で判別する。

| 項目 | テスト | 本番 |
|---|---|---|
| `USEN_SITE_CD` | TSJL | S203 |
| `USEN_MALL_CD` | TSJM | A300 |
| HMACキー | TSJL.NMK / TSJM.NMK | S203.NMK |
| `USEN_GROUP_ID` | `UDyJ3JuYxPru...`（テスト用） | `UDvfvtzYfetq...`（本番用） |
| フロントJS SDK | vic29.netmove.co.jp（dev） | payment-cdn.netmove.co.jp（本番） |
| merchants「テスト診療所」mall_code | TSJM | A300 |

### 環境切替手順（ローカル dev）

本番値・テスト値はそれぞれバックアップ済み:
- 本番値: `.env.local.prod_backup_20260608`
- テスト値: `.env.local.test_backup_20260604`

```bash
# 本番へ切替
cp .env.local.prod_backup_20260608 .env.local
# Supabase: テスト診療所 mall_code を A300 に戻す（SQL Editor）
#   UPDATE merchants SET mall_code='A300' WHERE id='69fd9433-5f2c-4359-bf56-1637e75aa048';

# テストへ切替
cp .env.local.test_backup_20260604 .env.local
#   UPDATE merchants SET mall_code='TSJM' WHERE id='69fd9433-...';
```

> env変更後は **dev サーバー再起動が必須**（Next.jsは env をビルド/起動時に取り込むため）。dev 稼働中に `npm run build` すると `.next/` が壊れCSS/JSが404になるので併用禁止。検証は `npx tsc --noEmit` + `npx vitest run` で行う。

---

## 2. Vercel 本番デプロイ（決済を含む）

### 2.1 Vercelプロジェクト構成
- `qolc-app`（co-gyro / Production Branch = **develop**）… 本体アプリ。LINE/LIFF/ポータル本番稼働中
- `qolc-lkz7`（園田さん加盟店フォーム / main）… 別プロジェクト

> 新規Import時のデフォルト Production Branch は `main`。**必ず Settings → Environments で `develop` に変更**。`NEXT_PUBLIC_*` はビルド時に埋め込まれるため、env変更後は **Redeploy 必須**。

### 2.2 HMACキーのVercel対応（base64方式）

USENのHMACキーは従来ファイルパス（`*_HMAC_KEY_PATH`）参照だったが、Vercelはファイルシステムを持たないため**base64環境変数方式**を追加済み（`src/lib/payment/hmac.ts`）。

- `USEN_SITE_HMAC_KEY_B64` / `USEN_MALL_HMAC_KEY_B64` を設定すると、ファイルパスより**優先**して使われる。
- 値はデコード後 **64バイト**であることを検証する（貼り付けミス・切り詰めは起動時にエラー検知）。

**base64値の生成**（鍵ファイルはリポジトリ外の `04_USEN/.../*.NMK`）:
```bash
# 本番サイト鍵（S203.NMK が site/mall 兼用の場合は同値を両方に設定）
base64 < /path/to/S203.NMK | tr -d '\n'
```
出力文字列を Vercel の Environment Variables（Production）に貼り付ける。

> ⚠️ base64値・鍵バイト列はログ・チャット・コミットに残さない。`.NMK` と `.env*.local` は .gitignore 済み。

### 2.3 Vercelに設定すべきUSEN env（本番決済を動かす場合）
```
USEN_SITE_CD=S203
USEN_MALL_CD=A300
USEN_SITE_HMAC_KEY_B64=（base64）
USEN_MALL_HMAC_KEY_B64=（base64）   # group_id方式では site鍵で全API署名するため未使用でも可
USEN_GROUP_ID=UDvfvtzYfetq...       # 本番用
USEN_TOKEN_CHECK_KEY_TYPE=site
USEN_MEMBER_API_BASE_URL=https://inet-uketsuke1.netmove.jp/payment
USEN_TOKEN_EC_API_BASE_URL=https://inet-uketsuke1.netmove.jp/ec-payment-uhup
NEXT_PUBLIC_USEN_TOKEN_JS_URL=https://payment-cdn.netmove.co.jp/ec-payment/static/js/ec-payment-web-adapter-token.umd.20260210.js
```

> 現状 `.env.vercel.local` にはLINE/Supabase系のみ設定済み。USEN系未投入のためVercel上では決済不可。**本番でVercel決済を解禁する判断が出たタイミングで上記を投入**する（実カード実課金のためユーザー明示指示後）。

### 2.4 領収書PDFの日本語フォント（必須）

利用料請求書兼領収書PDF（`src/lib/pdf/receipt-generator.ts`）は日本語TTFを埋め込む。未配置だと日本語が□表示になるため、本番前に必ずフォントを供給する。解決順（優先）:
1. `RECEIPT_FONT_PATH` … ローカルTTFの絶対パス（Node実行・Vercelでバンドルした場合）
2. `NEXT_PUBLIC_APP_URL` … `public/fonts/NotoSansJP-Regular.ttf` をURL参照（**この場合は当該TTFを public/fonts/ に配置してデプロイ**）
3. 相対 `/fonts/NotoSansJP-Regular.ttf`

> NotoSansJP Regular は容量が大きいためリポジトリ未コミット。デプロイ時に `public/fonts/` へ配置するか、`RECEIPT_FONT_PATH` でバンドル済みフォントを指す。3ケース（介護/医療/自費）のレイアウトは実サンプル（参考「レセプト」フォルダ Type B）準拠で1ページに2面（請求書兼領収書＋控）を収める。

---

## 3. 決済の締め・反映サイクル

- 明細はカード会社で **日次バッチ締め**後に反映（即時ではない）。JCB Link / NetAnser で翌営業日以降にダウンロード可能。
- カード登録時の **1円与信は payments テーブル外**。自動失効するため取消操作は不要。
- 月締めデータ → `/admin/csv-tools` でセルフィッシュ取込フォーマットに変換 → セルフィッシュへ連携。

---

## 4. 取消 / 返金 / 与信取消

アプリ内UI（`/admin/payments` の操作列）と USEN管理画面の両系統を用意。状態に応じてAPIを呼び分ける（`src/lib/payment/member-api.ts`、`/api/payment/[id]/cancel`）。

| 操作 | API | 対象状態 | 条件 |
|---|---|---|---|
| 与信取消（void） | authVoid | authorized | 売上計上前 |
| 売上取消（cancel） | salesCancel | captured | **同一締め内**。`sales_day`必須・元決済と一致 |
| 返金（return） | salesReturn | captured | **締め後（前月以前）**。同一締め内は code=41 で拒否される |

判断の目安: `captured_at` が当月なら「売上取消」、前月以前なら「返金」。UIが推奨バッジを表示する。誤って同一締め内に返金を選ぶと code=41（対象無し）で安全に弾かれる。

---

## 5. 障害対応（USENレスポンスコード）

`result=ng` 時は `code` で切り分ける。実機検証で確認済みの主なコード:

| code | 意味 | 対処 |
|---|---|---|
| 01 / 40 | 正常（与信/売上） | — |
| 02 | カード利用不可 | カード会社POS設定疑い。過去事例: JCBのPIN必須フラグ誤設定でEC取引がG42→code=02化。カード会社へ加盟店設定確認 |
| 05 | 取引不可 | 環境不整合の典型。**カード登録モールと決済モールの不一致**（例: 登録=TSJM/決済=A300）。group_id配下にそのモールが無いと発生 |
| 41 | 対象無し | 返金を同一締め内に実行した等。仕様通りの拒否（実装は正しい） |
| 45 | パラメータエラー | salescancel/salesreturn の `sales_day` 欠落・不一致。元決済の sales_day と一致必須 |

### 障害時の一次切り分け順
1. **環境確認**: `.env.local` がテスト/本番どちらか、merchants.mall_code が一致しているか
2. **署名**: HMACキー種別（group_id方式なら全API site鍵）。`USEN_*_HMAC_KEY_B64` のバイト長エラーが出ていないか
3. **カード固有か**: 別カード/別ブランドで再現するか（再現するなら加盟店設定側）
4. USEN古賀さん / カード会社へエスカレーション

---

## 6. デプロイ・ロールバック

- ブランチ: `develop`（GitHub: Co-gyro/QOLC）。CIはGitHub Actionsで緑維持。
- コミットは対象ファイルを限定して `git add`（`git add -A` は開発指示書等を巻き込むため禁止）。
- マイグレーションは Supabase ダッシュボード SQL Editor に貼り付け実行（CLI未リンク）。SQL Editorは1トランザクションでエラー時ロールバック。
- ロールバック: Vercel の Deployments から直前の正常デプロイを Promote。env起因なら値を戻して Redeploy。

---

## 7. リリース前チェックリスト

- [ ] `npx tsc --noEmit` がクリーン
- [ ] `npx vitest run` 全通過
- [ ] `.env.local` / Vercel env が意図した環境（テスト/本番）と一致
- [ ] merchants.mall_code が env と整合
- [ ] HMACキー（B64 or PATH）がロード可能（起動時エラーなし）
- [ ] 本番カード実課金を伴う操作はユーザー明示指示を取得済み

---

関連ドキュメント: [selfish-common-format-spec.md](selfish-common-format-spec.md) / [receipt-processing-design.md](receipt-processing-design.md) / [deploy-vercel-merchant-form-20260617.md](deploy-vercel-merchant-form-20260617.md)
