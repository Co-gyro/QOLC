# QOLC（コルク）システム設計書 v2

> 介護施設向け 利用明細・領収書発行SaaS

---

## 1. サービス概要

QOLCは、介護施設の入居者が利用したサービス（訪問診療・看護・介護・タクシー等）の明細をサービス提供者がアップロードすると自動でカード決済され、入居者・家族が明細を確認できるシステム。厚労省準拠の領収書発行機能も提供。

### ビジネスモデル

ユニバーサルがUSEN PSPと包括契約し、各サービス提供者（加盟店）と契約。決済手数料からユニバーサルの収益を得る。

### 主要な特徴

| 特徴 | 説明 |
|------|------|
| 自動決済 | 明細アップロードで即時決済。承認フェーズなし。 |
| 領収書発行 | 厚労省準拠フォーマット。月次でPDF発行、ダウンロード可能。 |
| LINE通知 | 入居者・家族はLINEで明細確認・領収書取得。 |

### 加盟店（サービス提供者）の種類

- 介護施設（介護保険サービス）
- 訪問診療クリニック
- 訪問看護ステーション
- 訪問歯科
- 訪問調剤薬局
- タクシー会社
- 買い物代行
- その他サービス

---

## 2. 開発スコープ

### 開発対象：QOLC

- **明細管理**: 明細アップロード受付、USEN PSPへ自動決済、明細表示・通知（LINE/Web/郵送）
- **領収書発行**: 厚労省準拠フォーマット、月次自動発行（N月末にN月分）、PDF生成・ダウンロード
- **加盟店登録**: サービス提供者の登録画面、セルフィッシュへのデータ連携
- **ユーザー管理**: 入居者・家族管理、施設管理、サービス提供者管理
- **認証**: Auth0 + LINE連携、Web認証（LINE未利用者）

### 対象外（別プロジェクト）

- **セルフィッシュ**: USEN PSPから売上データ取得、ユニバーサル手数料計算
- **USEN PSP**: 外部サービス（API連携のみ）

### 削除された機能

- **カレンダー・予約機能**: サービス提供者の都合で介護施設に訪問するため、入居者・家族からの予約は不要

### 外部連携

| 連携先 | 連携内容 | 備考 |
|--------|----------|------|
| USEN PSP | 決済API連携（リアルタイム） | API仕様確認必要 |
| セルフィッシュ | 加盟店登録（QOLC→）+ 明細データ取得（→QOLC） | I/F仕様調整必要 |

---

## 3. 利用者と画面

QOLCには4種類の利用者がいて、それぞれ別の画面が必要。

| 利用者 | 画面 | 主な機能 |
|--------|------|----------|
| **QOLC運営者（ユニバーサル）** | 管理画面 | 加盟店登録、施設管理、サービス提供者登録、全体監視 |
| **サービス提供者** | 提供者ポータル | 明細（レセプト）アップロード、決済状況確認 |
| **介護施設** | 施設ポータル | 入居者管理、アカウント管理、領収書発行設定 |
| **入居者・家族** | 利用者ポータル（/user） | 明細確認、領収書PDFダウンロード、カード登録 |

---

## 4. データフロー

### メインフロー

1. **明細アップロード** - サービス提供者がQOLCに利用明細（レセプト）をアップロード（随時）
2. **自動決済** - QOLCがUSEN PSPに決済指示、入居者のカードから引き落とし（即時・自動）
3. **売上データ蓄積** - USEN PSPに決済結果が蓄積
4. **明細データ取得** - セルフィッシュがUSEN PSPから売上データを取得（月次）
5. **明細データ連携** - QOLCがセルフィッシュから施設・入居者別の明細を取得（月次）
6. **明細表示・通知** - 入居者・家族がLINE/Webで明細を確認
7. **領収書発行** - 月末に当月分の領収書PDFを自動生成
8. **領収書ダウンロード** - 入居者・家族がPDFをダウンロード

### ポイント

- 明細アップロードがトリガーとなり、承認フェーズなしで即時決済
- 領収書はN月末にN月分を自動発行（設定変更可能）

---

## 5. 機能詳細

### 5.1 QOLC運営者（ユニバーサル）向け機能

- 介護施設の登録・管理
- 加盟店（サービス提供者）の登録 → セルフィッシュ連携
- 全体の利用状況分析（ダッシュボード）
- システム監視

### 5.2 サービス提供者向け機能

- 利用明細（レセプト）のアップロード
- アップロード履歴の確認
- 決済状況の確認

### 5.3 介護施設向け機能

- 入居者情報の管理
- アカウント情報の管理（入居者本人/家族アカウント、決済担当者設定）
- 領収書発行設定（発行タイミングのカスタム）
- 通知状況の確認
- ※カード登録は利用者本人が利用者ポータルから行う

### 5.4 利用者ポータル機能（/user）

- アカウント種別（入居者本人/家族）に応じた表示
- 利用明細の確認（事後確認）
- 領収書PDFのダウンロード
- カード登録・管理（決済担当者のみ）
- アカウント情報・通知設定

---

## 6. 領収書発行機能

### 背景

厚労省の取り決めにより、介護・医療サービスの提供者は利用者に対して領収書を発行する義務がある。QOLCでは、サービス提供者に代わって領収書を発行する機能を提供。

### 発行タイミング

- **基本設定**: N月末にN月分を自動発行
- **カスタム設定**: 介護事業者が発行タイミングを設定可能
- **トリガー例**: 振込完了時、月末締め、任意の日付

### 領収書フォーマット（検討事項）

> ⚠️ 厚労省の定めるフォーマット要件を確認し、準拠する必要あり

| 項目 | 内容 |
|------|------|
| 発行者情報 | サービス提供者名、住所、電話番号、事業所番号等 |
| 宛先 | 入居者名（または家族名） |
| 発行日 | 領収書発行日 |
| 利用期間 | 対象となるサービス利用期間 |
| 明細 | サービス内容、単位数、金額（保険分/自己負担分） |
| 合計金額 | 自己負担額の合計 |
| 領収書番号 | 一意の識別番号 |

### 発行フロー

1. 月次バッチ：当月の決済済み明細を集計
2. 入居者ごと・サービス提供者ごとに領収書データ生成
3. 厚労省準拠フォーマットでPDF生成
4. 入居者・家族へ通知（LINE/メール）
5. 入居者・家族がPDFダウンロード

---

## 7. 加盟店登録機能

### 背景

セルフィッシュ自体には加盟店登録のUIがないため、QOLC側（ユニバーサル管理画面）で登録画面を用意し、セルフィッシュにデータを連携する。

### 登録項目

| カテゴリ | 項目 |
|----------|------|
| 基本情報 | 事業者名、事業者名カナ、代表者名 |
| 連絡先 | 住所、電話番号、FAX、メールアドレス |
| 事業情報 | 事業所番号、サービス種別（医療/介護/その他） |
| 振込先 | 銀行名、支店名、口座種別、口座番号、口座名義 |
| 契約情報 | 契約開始日、手数料率 |
| 担当者 | 担当者名、担当者連絡先 |

### 登録フロー

1. ユニバーサル担当者がQOLC管理画面で加盟店情報を入力
2. 入力内容のバリデーション（必須項目、フォーマット）
3. セルフィッシュAPIを呼び出し、加盟店データを登録
4. セルフィッシュで加盟店マスタに登録完了
5. QOLC側にも加盟店情報を保存（参照用）

---

## 8. LINE設計

### 構成（マルチテナント対応）

LINE公式アカウント・LINEログインチャネル・Messaging APIチャネルはすべて1つで全施設共通。テナント（施設）ごとのデータ分離はバックエンド（DB）で制御。

### LINEで提供する機能

| 機能 | 内容 |
|------|------|
| 利用明細確認 | 月次明細の閲覧（事後確認） |
| 領収書取得 | PDFダウンロード |
| 通知受信 | 明細通知・領収書発行通知 |
| 設定 | 通知設定、カード情報 |

### 認証フロー（Auth0 + LINE）

1. 施設から届いたQRコードでLINE公式アカウント「QOLC」を友だち追加
2. リッチメニューをタップ → LINEログイン認証
3. Auth0がLINE IDとQOLCの入居者IDを紐づけ（初回のみ）
4. 以降はタップするだけで自動ログイン

### LINE未利用者への対応

| 選択肢 | 手段 | 想定割合 |
|--------|------|----------|
| 第1選択 | LINE | 70〜80% |
| 第2選択 | Web（メール認証） | 15〜25% |
| 第3選択 | 紙郵送 | 約5% |

---

## 9. データモデル（主要エンティティ）

### User（ユーザー）

```typescript
type UserRole = 'admin' | 'provider' | 'facility' | 'resident_family';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  facilityId?: string;      // 施設に所属する場合
  providerId?: string;      // サービス提供者の場合
  lineUserId?: string;      // LINE連携済みの場合
  createdAt: Date;
  updatedAt: Date;
}
```

### Facility（介護施設）

```typescript
interface Facility {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  receiptSettings: {
    issueDay: number;       // 発行日（1-31、0=月末）
    autoIssue: boolean;     // 自動発行するか
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Resident（入居者）

```typescript
interface Resident {
  id: string;
  facilityId: string;
  name: string;
  nameKana: string;
  birthDate: Date;
  insurerNumber: string;    // 被保険者番号（暗号化）
  cardTokenId?: string;     // USEN PSPのカードトークンID
  createdAt: Date;
  updatedAt: Date;
}
```

### Account（アカウント）

```typescript
type AccountType = 'self' | 'family';

interface Account {
  id: string;
  residentId: string;
  type: AccountType;          // 入居者本人 or 家族
  name: string;
  relationship?: string;      // 続柄（家族の場合）
  email?: string;
  phone?: string;
  lineUserId?: string;
  notifyMethod: 'line' | 'email' | 'mail';
  receiveNotify: boolean;     // 明細通知を受け取るか
  isBillingPerson: boolean;   // 決済担当者（1入居者につき1名のみ）
  createdAt: Date;
  updatedAt: Date;
}
```

### Merchant（加盟店 = サービス提供者）

```typescript
type ServiceType = 'medical' | 'nursing' | 'care' | 'taxi' | 'shopping' | 'other';

interface Merchant {
  id: string;
  name: string;
  nameKana: string;
  representativeName: string;
  address: string;
  phone: string;
  fax?: string;
  email: string;
  businessNumber: string;   // 事業所番号
  serviceType: ServiceType;
  bankInfo: {
    bankName: string;
    branchName: string;
    accountType: 'ordinary' | 'current';
    accountNumber: string;
    accountHolder: string;
  };
  contractStartDate: Date;
  feeRate: number;          // 手数料率
  selfishMerchantId?: string; // セルフィッシュ側のID
  createdAt: Date;
  updatedAt: Date;
}
```

### Statement（明細）

```typescript
type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface Statement {
  id: string;
  merchantId: string;
  residentId: string;
  facilityId: string;
  serviceDate: Date;        // サービス提供日
  items: StatementItem[];
  totalAmount: number;
  insuranceAmount: number;  // 保険適用額
  selfPayAmount: number;    // 自己負担額
  paymentStatus: PaymentStatus;
  paymentDate?: Date;
  usenTransactionId?: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface StatementItem {
  description: string;      // サービス内容
  unitCount: number;        // 単位数
  unitPrice: number;        // 単価
  amount: number;           // 金額
}
```

### Receipt（領収書）

```typescript
interface Receipt {
  id: string;
  receiptNumber: string;    // 領収書番号
  residentId: string;
  facilityId: string;
  merchantId: string;
  periodStart: Date;        // 対象期間開始
  periodEnd: Date;          // 対象期間終了
  statementIds: string[];   // 含まれる明細
  totalAmount: number;
  issuedAt: Date;
  pdfUrl?: string;
  downloadedAt?: Date;
  createdAt: Date;
}
```

### Notification（通知）

```typescript
type NotificationType = 'statement' | 'receipt' | 'system';
type NotificationChannel = 'line' | 'email' | 'web';
type NotificationStatus = 'pending' | 'sent' | 'failed';

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  relatedId?: string;       // 関連する明細/領収書ID
  status: NotificationStatus;
  sentAt?: Date;
  createdAt: Date;
}
```

---

## 10. セキュリティ要件

### 重要

QOLCは医療・介護に関わる個人情報（要配慮個人情報）を扱うため、通常のWebサービスより高いセキュリティレベルが求められる。

### 主要対策

| カテゴリ | 対策 |
|----------|------|
| 認証・認可 | 多要素認証、ロールベースアクセス制御、セッション管理 |
| データ保護 | 通信暗号化（TLS 1.2+）、DB暗号化、カード情報非保持 |
| アクセス制御 | マルチテナント分離、最小権限の原則、APIレベル権限チェック |
| 監査・監視 | 監査ログ記録、異常アクセス検知、インシデント対応 |

### 優先度

| 優先度 | 項目 |
|--------|------|
| 🔴 必須（リリース前） | HTTPS/TLS暗号化、Auth0認証・RBAC、データ暗号化、マルチテナント分離、監査ログ、利用規約 |
| 🟠 推奨（早期対応） | WAF導入、脆弱性診断、インシデント対応手順、バックアップ |
| 🔵 中期的 | ISMS取得、ペネトレーションテスト、プライバシーマーク取得 |

---

## 11. 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フロントエンド | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| バックエンド | Next.js API Routes |
| データベース | PostgreSQL |
| 認証 | Auth0 + LINE Login |
| ファイルストレージ | AWS S3 or GCS（領収書PDF保存） |
| PDF生成 | @react-pdf/renderer or puppeteer |
| 決済連携 | USEN PSP API |
| 通知 | LINE Messaging API, SendGrid（メール） |

---

## 12. 開発タスク

### Phase 1: 基盤構築

- [ ] Auth0セットアップ・ロールベースアクセス制御
- [ ] データベース設計・マイグレーション
- [ ] 基本的なCRUD API作成

### Phase 2: 運営者向け管理画面

- [ ] ダッシュボード（統計表示）
- [ ] 加盟店登録・管理機能
- [ ] 施設登録・管理機能
- [ ] ユーザー管理機能

### Phase 3: サービス提供者向け機能

- [ ] 明細アップロード機能
- [ ] CSVフォーマット対応
- [ ] アップロード履歴・決済状況確認

### Phase 4: 決済連携

- [ ] USEN PSP API連携
- [ ] カード登録フロー
- [ ] 自動決済処理

### Phase 5: 明細・領収書機能

- [ ] 明細表示機能
- [ ] 領収書PDF生成
- [ ] 月次バッチ処理
- [ ] ダウンロード機能

### Phase 6: LINE連携

- [ ] LINE公式アカウント設定
- [ ] LINE Login連携（Auth0経由）
- [ ] LIFF アプリ開発
- [ ] プッシュ通知機能

### Phase 7: セキュリティ・運用

- [ ] 監査ログ実装
- [ ] 脆弱性診断
- [ ] 利用規約・プライバシーポリシー
- [ ] 運用ドキュメント作成
