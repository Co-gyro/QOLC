# QOLC (コルク) - 介護施設向け決済SaaS

## プロジェクト概要
介護施設の入居者が利用したサービス（訪問診療、薬局、タクシー等）の自己負担額を
クレジットカードで非対面決済し、入居者・家族がLINE/Webで確認できるSaaSシステム。

運営: ユニバーサルデベロップメント株式会社（UD）

## 技術スタック
- **フレームワーク**: Next.js 14+ (App Router) / TypeScript（strict mode必須）
- **データベース**: Supabase PostgreSQL（Tokyo: ap-northeast-1）
- **認証**: Supabase Auth（管理者=メール+PW+MFA、家族=LINE Login）
- **ホスティング**: Vercel Pro（東京エッジ）
- **UI**: shadcn/ui + Tailwind CSS（QOLCデザインシステム準拠）
- **テスト**: Vitest（ユニット） + Playwright（E2E）
- **CSV処理**: Papa Parse + encoding-japanese（Shift-JIS対応）
- **PDF生成**: @react-pdf/renderer
- **Excel処理**: exceljs

## 現在の開発フェーズ
Phase 0（完了）: セルフィッシュ用CSV生成システム — 51テスト通過済み
Phase 1（これから）: 基盤構築 + 決済連携 + ポータルUI + データ処理

## 既存コードの構成（Phase 0 完了分）
```
src/
├── app/
│   ├── page.tsx                  ← 運営者ダッシュボード（モックアップ）
│   ├── facility/page.tsx         ← 施設ポータル（モックアップ）
│   ├── provider/page.tsx         ← 提供者ポータル（モックアップ）
│   ├── user/page.tsx             ← ユーザーポータル（モックアップ）
│   ├── admin/
│   │   ├── csv-tools/            ← CSV変換ツール（JCB/セゾン対応、実装済み）
│   │   └── merchant-application/ ← 加盟店申請フォーム（JCB EC/店頭、実装済み）
│   ├── layout.tsx
│   └── globals.css
├── components/ui/                ← shadcn/ui（button, card, input, label, tabs, textarea）
├── lib/
│   ├── csv/                      ← CSV処理ロジック（全テスト通過済み）
│   │   ├── jcb-rename.ts
│   │   ├── saison-rename.ts
│   │   ├── saison-fi.ts
│   │   ├── saison-fm.ts
│   │   └── naming.ts
│   ├── pdf/                      ← セゾン支払計算書PDF読取（実装済み）
│   │   ├── saison-pdf.ts
│   │   ├── saison-pdf-text.ts
│   │   └── saison-pdf-ocr.ts
│   ├── merchant-application/     ← 加盟店申請ロジック（実装済み）
│   │   ├── jcb-ec.ts
│   │   └── jcb-store.ts
│   ├── supabase/                 ← .gitkeep のみ（Phase 1 で実装）
│   └── utils.ts
├── types/                        ← .gitkeep のみ（Phase 1 で実装）
└── hooks/                        ← 未作成（Phase 1 で実装）
tests/
├── csv-naming.test.ts            ← CSV命名規則テスト
├── jcb-ec.test.ts                ← JCB EC申請テスト
├── jcb-rename.test.ts            ← JCBリネームテスト
├── jcb-store.test.ts             ← JCB店頭申請テスト
├── rounding.test.ts              ← 端数処理テスト
├── saison-fi.test.ts             ← セゾン振込情報テスト
├── saison-fm.test.ts             ← セゾン振込明細テスト
├── saison-rename.test.ts         ← セゾンリネームテスト
├── csv/                          ← テスト用CSVデータ
└── helpers/                      ← テストヘルパー
test-data/                        ← テスト用ダミーデータ（CSV, PDF, マスタ）
supabase/
└── migrations/                   ← 空（Phase 1 で作成）
```

## Phase 1 で追加するディレクトリ構成
```
src/
├── app/
│   ├── (auth)/              ← 認証関連ページ（ログイン等）【新規】
│   ├── admin/
│   │   ├── dashboard/       ← 管理ダッシュボード【page.tsxを発展】
│   │   ├── facilities/      ← 施設管理【新規】
│   │   ├── merchants/       ← 加盟店管理【merchant-applicationを発展】
│   │   ├── payments/        ← 決済管理【新規】
│   │   ├── csv-tools/       ← CSV変換ツール【既存】
│   │   └── master/          ← マスタ管理【新規】
│   ├── facility/
│   │   ├── dashboard/       ← 施設ダッシュボード【page.tsxを発展】
│   │   ├── residents/       ← 入居者管理【新規】
│   │   ├── statements/      ← 明細管理【新規】
│   │   ├── payments/        ← 決済状況【新規】
│   │   └── providers/       ← 提供者管理【新規】
│   ├── provider/
│   │   ├── dashboard/       ← 提供者ダッシュボード【page.tsxを発展】
│   │   ├── upload/          ← 明細アップロード【新規】
│   │   └── facilities/      ← 取引先施設一覧【新規】
│   ├── user/
│   │   ├── home/            ← ホーム【page.tsxを発展】
│   │   ├── statements/      ← 利用明細【新規】
│   │   ├── receipts/        ← 領収書【新規】
│   │   └── card/            ← カード管理【新規】
│   └── api/                 ← API Routes【新規】
│       ├── payment/         ← USEN PSP連携
│       ├── upload/          ← 明細アップロード
│       ├── auth/            ← 認証関連
│       └── webhook/         ← 外部Webhook
├── lib/
│   ├── supabase/            ← Supabase client + types【新規】
│   │   ├── client.ts
│   │   ├── server.ts
│   │   ├── admin.ts
│   │   └── types.ts         ← DB型定義（自動生成）
│   ├── payment/             ← USEN PSP API【新規】
│   │   ├── hmac.ts          ← HMAC-SHA256 / HMAC-MD5
│   │   ├── token-api.ts     ← EC決済API（カード登録）
│   │   ├── member-api.ts    ← 会員ID決済API
│   │   └── types.ts
│   ├── receipt/             ← レセプトデータ解析【新規】
│   └── utils/               ← 共通ユーティリティ【新規】
├── components/
│   ├── ui/                  ← shadcn/ui【既存 + 追加】
│   ├── layout/              ← レイアウト（サイドバー等）【新規】
│   ├── forms/               ← フォーム部品【新規】
│   └── shared/              ← 共通コンポーネント【新規】
├── hooks/                   ← カスタムフック【新規】
├── types/                   ← グローバル型定義【新規】
└── middleware.ts            ← 認証ミドルウェア【新規】
```

## 重要なルール

### コード品質
- TypeScript strict mode を有効にする。any型の使用禁止
- すべての関数に JSDoc コメントを付ける
- コンポーネントは1ファイル200行以内。超える場合は分割する
- 新しいファイルを作成したら、対応するテストファイルも必ず作成する
- コミットメッセージは日本語OK。Conventional Commits 形式推奨（feat:, fix:, refactor:）
- 既存の Phase 0 コード（src/lib/csv/, tests/）は動作確認済み。変更する場合は全テストが通過すること

### セキュリティ（最重要）
- **HMACキー、APIキー、シークレットは絶対にコードにハードコードしない**。すべて環境変数（.env.local）経由
- **SQLインジェクション防止**: Supabase clientのクエリビルダーを使用。生SQL禁止
- **RLS必須**: すべてのテーブルにRow Level Securityポリシーを設定。RLSなしのテーブルは作らない
- **入力バリデーション**: すべてのAPI Routeの入力をzodでバリデーション
- **CSVアップロード**: ファイルサイズ上限（10MB）、行数上限（10,000行）、MIMEタイプチェック
- **USEN PSP APIの通信**: HMAC署名の検証を必ず実施。テスト環境と本番でエンドポイントが異なる点に注意
- **カード情報**: QOLCはカード番号を一切保持しない。USENのトークンとmember_idのみ保持
- **監査ログ**: 決済関連の操作（決済実行、取消、返金）はすべてログテーブルに記録

### デザインシステム準拠
- プライマリカラー: #4C986A（QOLCロゴ色）
- プライマリホバー: #3D7A55
- 背景（薄緑）: #F0F9F4
- ウォームアクセント: #E8913A（注意、ハイライト）
- テキスト: #333333
- ボーダー: #E0DDD8
- フォント: Noto Sans JP + Inter
- 最小フォントサイズ: 14px（高齢者対応、絶対に下回らないこと）
- ボタン最小高さ: 44px（タッチ対応）
- shadcn/uiのテーマをカスタマイズして使用（独自CSSは最小限に）
- 詳細は QOLC_design_system.html を参照

### データベース
- テーブル名・カラム名: snake_case（PostgreSQL慣習）
- 主キー: UUID（Supabase auth.users.id と連携するため）
- created_at / updated_at: 全テーブルに必須
- ソフトデリート: deleted_at カラム（物理削除は禁止）
- マイグレーションファイルは連番管理（001_create_users.sql, 002_create_facilities.sql ...）

### CSV処理（Phase 0 ルール — 維持すること）
- 文字コード: セルフィッシュ用CSVはShift-JIS（CP932）で出力
- 改行コード: CRLF
- CSV命名規則: {カード会社}_{データ種別}_{締日}_{支払先番号}.csv
- JCB CSVは加工せずリネームのみ
- セゾンCSVはUR=リネーム、FI/FM=集計処理が必要

### 環境変数
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
USEN_SITE_CD=S203
USEN_HMAC_KEY_PATH=（HMACキーファイルのパス）
USEN_API_BASE_URL=https://inet-uketsuke1.netmove.jp
USEN_TOKEN_API_BASE_URL=https://inet-uketsuke1.netmove.jp
NEXT_PUBLIC_APP_URL=https://app.qolc.jp
```

## 4ポータルのルーティングと認証

| パス | ポータル | 必要ロール | 認証方式 |
|---|---|---|---|
| /admin/* | 運営者管理画面 | admin | メール+PW+MFA |
| /facility/* | 介護施設ポータル | facility_staff | メール+PW |
| /provider/* | サービス提供者ポータル | provider | メール+PW |
| /user/* | ユーザーポータル | family | LINE Login or メール+PW |

middleware.ts でJWTのcustom claimsをチェックし、ロールに応じたリダイレクトを行う。

## USEN PSP API

### テスト環境
- Token API: https://inet-uketsuke.netmove.jp/ec-payment-uhup
- Member API: https://inet-uketsuke.netmove.jp/payment
- site_cd: TSJL / mall_cd: TSJM
- HMACキー: TSJL.NMK / TSJM.NMK

### 本番環境
- Token API: https://inet-uketsuke1.netmove.jp/ec-payment-uhup
- Member API: https://inet-uketsuke1.netmove.jp/payment
- site_cd: S203
- HMACキー: S203.NMK
- モールコード: A300〜A3ZZ（1,296件プール）
- 端末識別番号: 3124620001000〜3124620001999（1,000件プール）

### 認証方式の違い（重要）
- EC決済API（カード登録）: **HMAC-SHA256**
- 会員ID決済API（定常決済）: **HMAC-MD5**
- 同じ64バイトバイナリキーだがアルゴリズムが異なる

## 参考ドキュメント
- QOLC_要件整理_未決定事項一覧.md（最も詳細な要件定義）
- QOLC基本設計方針書_v1.0.docx（全体設計方針）
- QOLC_design_system.html（デザインシステム）
- 開発指示書/ フォルダ（各チームの詳細タスク指示）
