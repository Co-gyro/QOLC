# QOLC（コルク） - 介護施設向け利用明細・領収書発行SaaS

## 概要

介護施設向けの利用明細・領収書発行SaaSアプリケーション。
- サービス提供者が明細をアップロード → 自動決済
- 利用者（入居者本人・家族）が利用者ポータルで明細確認・領収書ダウンロード
- 運営者（ユニバーサル）が加盟店・施設を登録・管理

## 技術スタック

| 技術 | バージョン | 用途 |
|------|----------|------|
| Next.js | 14 (App Router) | フロントエンド/バックエンド |
| TypeScript | 5.x | 型安全 |
| Tailwind CSS | 3.x | スタイリング |
| lucide-react | - | 利用者ポータル用アイコン |
| PostgreSQL | (後で接続) | データベース |
| Auth0 | (後で接続) | 認証 |

## フォルダ構成

```
QOLC/
├── app/                          # ページ (App Router)
│   ├── layout.tsx                # ルートレイアウト
│   ├── (admin)/                  # 運営者管理画面（ユニバーサル）
│   │   ├── page.tsx              # ダッシュボード
│   │   ├── layout.tsx            # 管理画面レイアウト
│   │   ├── facilities/           # 介護施設管理
│   │   │   ├── page.tsx          # 施設一覧
│   │   │   ├── new/page.tsx      # 施設登録
│   │   │   └── [id]/page.tsx     # 施設詳細
│   │   ├── merchants/            # 加盟店管理
│   │   │   ├── page.tsx          # 加盟店一覧
│   │   │   └── new/page.tsx      # 加盟店登録
│   │   ├── operators/            # 運営者管理
│   │   │   ├── page.tsx          # 運営者一覧
│   │   │   └── new/page.tsx      # 運営者登録
│   │   ├── statements/           # 明細管理
│   │   │   ├── page.tsx          # 明細一覧
│   │   │   └── [id]/page.tsx     # 明細詳細
│   │   ├── receipts/             # 領収書管理
│   │   │   ├── page.tsx          # 領収書一覧
│   │   │   └── [id]/page.tsx     # 領収書詳細
│   │   ├── payments/page.tsx     # 決済管理
│   │   ├── users/page.tsx        # ユーザー管理
│   │   ├── notifications/page.tsx # 通知管理
│   │   └── master/               # マスタ管理
│   │       ├── page.tsx          # マスタ管理トップ
│   │       └── formats/new/page.tsx # フォーマット登録
│   │
│   ├── (provider)/provider/      # サービス提供者ポータル
│   │   ├── page.tsx              # ダッシュボード
│   │   ├── layout.tsx            # 提供者レイアウト
│   │   ├── upload/page.tsx       # 明細アップロード
│   │   ├── history/              # アップロード履歴
│   │   │   ├── page.tsx          # 履歴一覧
│   │   │   └── [id]/page.tsx     # 履歴詳細
│   │   └── settings/page.tsx     # 設定
│   │
│   ├── (facility)/facility/      # 介護施設ポータル
│   │   ├── page.tsx              # ダッシュボード
│   │   ├── layout.tsx            # 施設レイアウト
│   │   ├── residents/            # 入居者管理
│   │   │   ├── page.tsx          # 入居者一覧
│   │   │   ├── new/page.tsx      # 入居者登録（3ステップ）
│   │   │   └── [id]/page.tsx     # 入居者詳細
│   │   ├── providers/            # サービス提供者管理
│   │   │   ├── page.tsx          # 利用中一覧
│   │   │   └── add/page.tsx      # 提供者追加
│   │   ├── statements/page.tsx   # 明細確認
│   │   ├── staff/page.tsx        # スタッフ管理
│   │   └── settings/page.tsx     # 設定
│   │
│   └── (user)/user/              # 利用者ポータル（旧: 入居者・家族向け画面）
│       ├── page.tsx              # ホーム
│       ├── layout.tsx            # 利用者レイアウト
│       ├── statements/           # 明細
│       │   ├── page.tsx          # 明細一覧
│       │   └── [id]/page.tsx     # 明細詳細
│       ├── receipts/page.tsx     # 領収書
│       ├── card/page.tsx         # カード管理
│       └── settings/page.tsx     # 設定
│
├── components/                   # 共通コンポーネント
│   ├── layout/                   # 管理画面レイアウト
│   │   ├── Sidebar.tsx           # サイドバーナビ
│   │   └── Header.tsx            # ページヘッダー
│   ├── provider/                 # 提供者ポータル用
│   │   ├── ProviderSidebar.tsx
│   │   ├── ProviderHeader.tsx
│   │   └── Stepper.tsx
│   ├── facility/                 # 施設ポータル用
│   │   ├── FacilitySidebar.tsx
│   │   └── FacilityHeader.tsx
│   ├── user/                     # 利用者ポータル用（旧: family/）
│   │   ├── TabBar.tsx            # 下部タブバー
│   │   ├── MobileHeader.tsx      # モバイルヘッダー
│   │   └── CardRegistrationModal.tsx # カード登録モーダル
│   └── ui/                       # UIコンポーネント
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Badge.tsx
│       ├── Table.tsx
│       └── FileUpload.tsx
│
├── lib/                          # ユーティリティ
│   ├── types.ts                  # 型定義
│   ├── constants.ts              # 定数
│   └── utils.ts                  # ヘルパー関数
│
└── docs/                         # ドキュメント
    ├── README.md                 # このファイル
    ├── qolc-system-design.md     # システム設計書
    ├── qolc-account-management.md # アカウント管理設計書
    ├── qolc-facility-portal.md   # 施設ポータル設計書
    ├── qolc-family-portal.md     # 利用者ポータル設計書
    ├── qolc-provider-portal.md   # 提供者ポータル設計書
    ├── qolc-operator-roles.md    # 運営者業務一覧
    ├── qolc-upload-format.md     # アップロードフォーマット管理
    ├── qolc-facility-merchant-relation.md # 施設・提供者紐づけ設計
    └── qolc-system-update-instructions.md # システム更新指示書
```

## 主要機能

### 1. 運営者管理画面（/admin）
- 介護施設の登録・管理
- 加盟店（サービス提供者）の登録 → セルフィッシュ連携
- 運営者アカウント管理
- 明細・領収書・決済の全体監視
- マスタ管理（アップロードフォーマット等）

### 2. サービス提供者ポータル（/provider）
- CSV/Excelファイルでの明細アップロード
- アップロード履歴・決済状況確認
- 紐づけ施設の確認

### 3. 介護施設ポータル（/facility）
- 入居者情報の管理
- アカウント管理（入居者本人/家族アカウント、決済担当者設定）
- サービス提供者の紐づけ管理
- 明細確認・領収書設定
- ※カード登録は施設では行わない（利用者本人が利用者ポータルから実施）

### 4. 利用者ポータル（/user）
- アカウント種別に応じた表示（入居者本人/家族）
- 利用明細の確認（月別）
- 領収書PDFのダウンロード
- カード登録・変更（決済担当者のみ）
- 通知設定・アカウント情報確認

### カラースキーム

| ポータル | メインカラー |
|---------|------------|
| 運営者管理画面 | ブルー（blue） |
| サービス提供者ポータル | ブルー（blue-600） |
| 介護施設ポータル | グリーン（emerald-600） |
| 利用者ポータル | グリーン（emerald-600） |

### ユーザーロール

| ロール | ログイン先 |
|--------|----------|
| 運営者（ユニバーサル） | 管理画面 |
| サービス提供者 | 提供者ポータル |
| 施設管理者/スタッフ | 施設ポータル |
| 入居者・家族 | 利用者ポータル |

## 開発方法

```bash
# 依存パッケージのインストール
npm install

# 開発サーバー起動（ポート3001）
npm run dev -- -p 3001

# ビルド
npm run build

# Lint
npm run lint
```

## 今後の予定

- [ ] PostgreSQL接続（Prisma ORM）
- [ ] Auth0認証統合
- [ ] LINE Messaging API連携
- [ ] PDF生成機能（領収書）
- [ ] USEN PSP決済連携
- [ ] セルフィッシュ連携
- [ ] E2Eテスト
