# QOLC - 介護施設向け利用明細・領収書発行SaaS

## 概要

介護施設向けの利用明細・領収書発行SaaSアプリケーション。
- サービス提供者が明細をアップロード → 自動決済
- 入居者・家族がLINE/Webで明細確認・領収書ダウンロード
- ユニバーサル（運営者）が加盟店を登録

## 技術スタック

| 技術 | バージョン | 用途 |
|------|----------|------|
| Next.js | 14 (App Router) | フロントエンド/バックエンド |
| TypeScript | 5.x | 型安全 |
| Tailwind CSS | 3.x | スタイリング |
| PostgreSQL | (後で接続) | データベース |
| Auth0 | (後で接続) | 認証 |

## フォルダ構成

```
QOLC/
├── app/                    # ページ (App Router)
│   ├── page.tsx           # ダッシュボード
│   ├── layout.tsx         # ルートレイアウト
│   ├── statements/        # 明細管理
│   │   ├── page.tsx       # 明細一覧
│   │   └── [id]/page.tsx  # 明細詳細
│   ├── receipts/          # 領収書
│   │   ├── page.tsx       # 領収書一覧
│   │   └── [id]/page.tsx  # 領収書詳細
│   ├── merchants/         # 加盟店管理
│   │   ├── page.tsx       # 加盟店一覧
│   │   └── new/page.tsx   # 新規加盟店登録
│   ├── users/             # ユーザー管理
│   │   └── page.tsx       # ユーザー一覧
│   └── notifications/     # 通知
│       └── page.tsx       # 通知一覧
├── components/            # 共通コンポーネント
│   ├── layout/            # レイアウト
│   │   ├── Sidebar.tsx    # サイドバーナビ
│   │   └── Header.tsx     # ページヘッダー
│   └── ui/                # UIコンポーネント
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Badge.tsx
│       ├── Table.tsx
│       └── FileUpload.tsx
├── lib/                   # ユーティリティ
│   ├── types.ts           # 型定義
│   ├── constants.ts       # 定数
│   └── utils.ts           # ヘルパー関数
└── docs/                  # ドキュメント
    └── README.md
```

## 主要機能

### 1. 明細アップロード（サービス提供者向け）
- CSV/Excelファイルのドラッグ&ドロップアップロード
- 明細ステータス管理（アップロード済→処理中→確認済→決済完了）

### 2. 明細表示・通知（入居者・家族向け）
- 明細一覧・詳細表示
- LINE/メール/Web通知

### 3. 領収書発行・PDFダウンロード
- 領収書自動発行
- PDF形式でダウンロード

### 4. 加盟店登録（運営者向け）
- 加盟店基本情報の登録
- 口座情報管理
- ステータス管理（審査中→有効→無効）

### 5. ユーザー管理
- 4種類のロール: 運営者、サービス提供者、入居者、ご家族
- ロールベースアクセス制御

## 開発方法

```bash
# 依存パッケージのインストール
npm install

# 開発サーバー起動
npm run dev

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
- [ ] 決済機能統合
- [ ] E2Eテスト
