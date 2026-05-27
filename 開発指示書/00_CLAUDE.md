# QOLC (コルク) - 介護施設向け決済SaaS

> **注**: このファイルは開発指示書フォルダの保管用です。
> 実際にプロジェクトで使われる CLAUDE.md は QOLC プロジェクトルートに配置済みです。
> 内容を変更する場合は、プロジェクトルートの CLAUDE.md を直接編集してください。

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
- **CSV処理**: Papa Parse
- **PDF生成**: @react-pdf/renderer

## ディレクトリ構成
```
qolc/
├── CLAUDE.md                    ← このファイル
├── .env.local                   ← 環境変数（.gitignore済み）
├── src/
│   ├── app/                     ← Next.js App Router
│   │   ├── (auth)/              ← 認証関連ページ（ログイン等）
│   │   ├── admin/               ← 運営者管理画面
│   │   │   ├── dashboard/
│   │   │   ├── facilities/
│   │   │   ├── merchants/
│   │   │   ├── payments/
│   │   │   ├── csv-tools/       ← Phase 0: CSV変換ツール
│   │   │   └── master/
│   │   ├── facility/            ← 介護施設ポータル
│   │   │   ├── residents/
│   │   │   ├── statements/
│   │   │   ├── payments/
│   │   │   └── providers/
│   │   ├── provider/            ← サービス提供者ポータル
│   │   │   ├── upload/
│   │   │   └── facilities/
│   │   ├── user/                ← ユーザーポータル（入居者・家族）
│   │   │   ├── statements/
│   │   │   ├── receipts/
│   │   │   └── card/
│   │   └── api/                 ← API Routes
│   │       ├── payment/         ← USEN PSP連携
│   │       ├── upload/          ← 明細アップロード
│   │       ├── auth/            ← 認証関連
│   │       └── webhook/         ← 外部Webhook
│   ├── lib/
│   │   ├── supabase/            ← Supabase client + types
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   ├── admin.ts
│   │   │   └── types.ts         ← DB型定義（自動生成）
│   │   ├── payment/             ← USEN PSP API
│   │   │   ├── hmac.ts          ← HMAC-SHA256 / HMAC-MD5
│   │   │   ├── token-api.ts     ← EC決済API（カード登録）
│   │   │   ├── member-api.ts    ← 会員ID決済API
│   │   │   └── types.ts
│   │   ├── csv/                 ← CSV処理（Phase 0から移行）
│   │   ├── pdf/                 ← PDF生成
│   │   ├── receipt/             ← レセプトデータ解析
│   │   └── utils/               ← 共通ユーティリティ
│   ├── components/
│   │   ├── ui/                  ← shadcn/uiコンポーネント
│   │   ├── layout/              ← レイアウト（サイドバー等）
│   │   ├── forms/               ← フォーム部品
│   │   └── shared/              ← 共通コンポーネント
│   ├── hooks/                   ← カスタムフック
│   ├── types/                   ← グローバル型定義
│   └── middleware.ts            ← 認証ミドルウェア（ポータル振り分け）
├── supabase/
│   ├── migrations/              ← DBマイグレーション（番号付き）
│   ├── seed.sql                 ← テスト用シードデータ
│   └── config.toml
├── tests/
│   ├── unit/                    ← Vitestユニットテスト
│   ├── e2e/                     ← Playwright E2Eテスト
│   └── fixtures/                ← テスト用データ
├── docs/                        ← 設計書
│   └── security/                ← セキュリティレビュー記録
└── scripts/                     ← 開発用スクリプト
```

## 重要なルール

### コード品質
- TypeScript strict mode を有効にする。any型の使用禁止
- すべての関数に JSDoc コメントを付ける
- コンポーネントは1ファイル200行以内。超える場合は分割する
- 新しいファイルを作成したら、対応するテストファイルも必ず作成する
- コミットメッセージは日本語OK。Conventional Commits 形式推奨（feat:, fix:, refactor:）

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
- フォント: Noto Sans JP + Inter
- 最小フォントサイズ: 14px（高齢者対応）
- shadcn/uiのテーマをカスタマイズして使用（独自CSSは最小限に）

### データベース
- テーブル名・カラム名: snake_case（PostgreSQL慣習）
- 主キー: UUID（Supabase auth.users.id と連携するため）
- created_at / updated_at: 全テーブルに必須
- ソフトデリート: deleted_at カラム（物理削除は禁止）
- マイグレーションファイルは連番管理（001_create_users.sql, 002_create_facilities.sql ...）

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
- docs/ 配下の設計書
- QOLC_要件整理_未決定事項一覧.md（最も詳細な要件定義）
- QOLC基本設計方針書_v1.0.docx（全体設計方針）
- QOLC_design_system.html（デザインシステム）
