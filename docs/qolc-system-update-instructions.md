# QOLC システム更新指示書

## 概要

本ドキュメントは、システム理解資料（qolc-system-understanding-v2.pdf）の内容をQOLCシステムに反映するための指示書です。

**作成日**: 2026年2月27日  
**ステータス**: 関係者確認済み

---

## 目次

1. [変更の全体像](#1-変更の全体像)
2. [データモデルの変更](#2-データモデルの変更)
3. [運営者ポータルの変更](#3-運営者ポータルの変更)
4. [サービス提供者ポータルの変更](#4-サービス提供者ポータルの変更)
5. [介護施設ポータルの変更](#5-介護施設ポータルの変更)
6. [ユーザーポータルの変更](#6-ユーザーポータルの変更)
7. [外部連携の実装](#7-外部連携の実装)
8. [バッチ処理の実装](#8-バッチ処理の実装)
9. [実装優先順位](#9-実装優先順位)
10. [チェックリスト](#10-チェックリスト)

---

## 1. 変更の全体像

### 1.1 主要な変更点サマリー

| # | カテゴリ | 変更内容 | 影響範囲 |
|---|---------|---------|---------|
| 1 | 加盟店登録 | 審査フロー追加、セルフィッシュ連携 | 運営者ポータル、データモデル |
| 2 | 決済タイミング | 即時決済（アップロード時） | サービス提供者ポータル、USEN PSP連携 |
| 3 | 集計タイミング | 月2回（15日・月末） | バッチ処理、運営者ポータル |
| 4 | 表示頻度設定 | 施設ごとに月1回/月2回選択 | 介護施設ポータル、ユーザーポータル |
| 5 | 提供者ポータル | 利用明細を出さない | サービス提供者ポータル |
| 6 | カード登録 | 本人が登録（施設は登録不可） | 介護施設ポータル、ユーザーポータル |
| 7 | アカウント種別 | 入居者本人/家族、決済担当 | 全ポータル、データモデル |

### 1.2 システム境界の明確化

```
【QOLCの責務】
├── 明細管理（レセプト取込、明細生成）
├── 利用者通知（入居者・家族へLINE/メール）
├── 各種ポータル画面
├── 集計処理（月2回）
└── 加盟店申請受付

【QOLCがやらないこと】
├── 決済処理 → USEN PSPが実行
├── 入金・振込処理 → セルフィッシュが実行
└── 店子への利用明細出力 → セルフィッシュが実行
```

---

## 2. データモデルの変更

### 2.1 新規エンティティ

#### 2.1.1 MerchantApplication（加盟店申請）

```typescript
interface MerchantApplication {
  id: string;
  
  // 申請者情報
  companyName: string;           // 事業者名
  representativeName: string;    // 代表者名
  businessType: 'medical' | 'taxi' | 'pharmacy' | 'other'; // 業種
  businessTypeOther?: string;    // 業種（その他の場合）
  
  // 連絡先
  postalCode: string;
  address: string;
  phone: string;
  email: string;
  
  // 振込先口座
  bankName: string;
  branchName: string;
  accountType: 'ordinary' | 'current'; // 普通/当座
  accountNumber: string;
  accountHolder: string;
  
  // ステータス
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  
  // 審査結果（審査通過後）
  merchantCode?: string;         // 加盟店番号
  mallCode?: string;             // モールコード
  
  // タイムスタンプ
  submittedAt: Date;
  reviewedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  
  // 関連
  reviewedBy?: string;           // 審査担当者ID
}
```

#### 2.1.2 FacilityGroup（施設グループ/法人）

```typescript
interface FacilityGroup {
  id: string;
  name: string;                  // グループ名（例：共立グループ）
  
  // 共通振込先（あれば）
  useCommonBankAccount: boolean;
  bankName?: string;
  branchName?: string;
  accountType?: 'ordinary' | 'current';
  accountNumber?: string;
  accountHolder?: string;
  
  // タイムスタンプ
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 既存エンティティの変更

#### 2.2.1 Facility（介護施設）への追加

```typescript
interface Facility {
  // ... 既存フィールド ...
  
  // 追加フィールド
  groupId?: string;              // 施設グループID（任意）
  merchantCode: string;          // 加盟店番号
  mallCode: string;              // モールコード
  
  // 表示頻度設定（新規）
  displayFrequency: 'monthly' | 'bimonthly'; // 月1回 / 月2回
  
  // セルフィッシュ登録状態
  selfishRegistered: boolean;
  selfishRegisteredAt?: Date;
}
```

#### 2.2.2 ServiceProvider（サービス提供者）への追加

```typescript
interface ServiceProvider {
  // ... 既存フィールド ...
  
  // 追加フィールド
  applicationId?: string;        // 加盟店申請ID
  merchantCode: string;          // 加盟店番号
  mallCode: string;              // モールコード
  
  // セルフィッシュ登録状態
  selfishRegistered: boolean;
  selfishRegisteredAt?: Date;
}
```

#### 2.2.3 ResidentAccount（入居者アカウント）の変更

```typescript
interface ResidentAccount {
  id: string;
  residentId: string;
  
  // アカウント種別
  type: 'self' | 'family';       // 入居者本人 / 家族
  
  // 基本情報
  name: string;
  relationship?: 'spouse' | 'son' | 'daughter' | 'other'; // 家族のみ
  relationshipOther?: string;
  phone?: string;
  email?: string;
  
  // 通知設定
  notificationMethod: 'line' | 'email' | 'postal';
  receiveNotification: boolean;
  lineUserId?: string;
  
  // 決済担当（1入居者につき1人のみ）
  isBillingPerson: boolean;
  
  // カード情報（決済担当のみ）
  cardToken?: string;            // USEN PSPトークン
  cardBrand?: string;            // Visa, Mastercard, JCB等
  cardLast4?: string;            // 下4桁
  cardExpiryMonth?: string;
  cardExpiryYear?: string;
  cardRegisteredAt?: Date;
  
  // ステータス
  status: 'invited' | 'active' | 'inactive';
  invitedAt?: Date;
  activatedAt?: Date;
  
  // タイムスタンプ
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2.2.4 Statement（明細）への追加

```typescript
interface Statement {
  // ... 既存フィールド ...
  
  // 決済情報（新規）
  paymentStatus: 'pending' | 'authorized' | 'captured' | 'failed';
  authorizedAt?: Date;           // オーソリ日時
  capturedAt?: Date;             // 売上確定日時
  paymentErrorCode?: string;
  paymentErrorMessage?: string;
  
  // USEN PSP情報
  transactionId?: string;        // USEN PSPトランザクションID
  
  // 集計期間
  aggregationPeriod: '1H' | '2H'; // 1H: 1日〜15日, 2H: 16日〜月末
  aggregatedAt?: Date;           // 集計日時
}
```

### 2.3 新規エンティティ（集計関連）

#### 2.3.1 AggregationBatch（集計バッチ）

```typescript
interface AggregationBatch {
  id: string;
  
  // 集計期間
  year: number;
  month: number;
  period: '1H' | '2H';           // 1H: 1日〜15日, 2H: 16日〜月末
  
  // ステータス
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // 集計結果
  totalAmount: number;
  transactionCount: number;
  
  // タイムスタンプ
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // エラー情報
  errorMessage?: string;
}
```

---

## 3. 運営者ポータルの変更

### 3.1 新規画面

#### 3.1.1 加盟店申請管理

**URL**: `/admin/merchant-applications`

**機能**:
- 申請一覧（ステータスでフィルタ可能）
- 申請詳細の確認
- ステータス変更（審査中→承認/却下）
- 加盟店番号・モールコードの登録
- セルフィッシュへの登録実行

**画面構成**:
```
┌─────────────────────────────────────────────────────┐
│ 加盟店申請管理                                       │
├─────────────────────────────────────────────────────┤
│ [申請中] [審査中] [承認済] [却下] │ 検索: [________] │
├─────────────────────────────────────────────────────┤
│ # │ 申請日 │ 事業者名 │ 業種 │ ステータス │ 操作    │
│ 1 │ 2/25  │ A診療所  │ 医療 │ 審査中     │ [詳細]  │
│ 2 │ 2/24  │ Bタクシー│ 移送 │ 申請中     │ [詳細]  │
└─────────────────────────────────────────────────────┘
```

**申請詳細画面**:
```
┌─────────────────────────────────────────────────────┐
│ 申請詳細: A診療所                    ステータス: 審査中│
├─────────────────────────────────────────────────────┤
│ 【申請情報】                                         │
│ 事業者名: A診療所                                    │
│ 代表者名: 山田太郎                                   │
│ 業種: 訪問診療                                       │
│ 住所: 東京都...                                      │
│ 電話: 03-xxxx-xxxx                                  │
│ メール: info@a-clinic.jp                            │
├─────────────────────────────────────────────────────┤
│ 【振込先口座】                                       │
│ 銀行: ○○銀行 △△支店                               │
│ 口座: 普通 1234567                                  │
│ 名義: カ）エークリニック                             │
├─────────────────────────────────────────────────────┤
│ 【審査結果】※承認時のみ入力                          │
│ 加盟店番号: [____________]                          │
│ モールコード: [____________]                         │
├─────────────────────────────────────────────────────┤
│ [却下] [承認してQOLC登録]                            │
└─────────────────────────────────────────────────────┘
```

#### 3.1.2 施設グループ管理

**URL**: `/admin/facility-groups`

**機能**:
- 施設グループの作成・編集・削除
- グループに属する施設の一覧
- 共通振込先の設定

#### 3.1.3 集計バッチ管理

**URL**: `/admin/aggregation`

**機能**:
- 集計バッチの一覧（年月・期間でフィルタ）
- 手動実行
- 実行結果の確認
- エラー時の再実行

### 3.2 既存画面の変更

#### 3.2.1 サービス提供者一覧

**変更点**:
- 加盟店番号・モールコードの表示を追加
- セルフィッシュ登録状態の表示を追加
- 「申請から登録」フローへの変更（直接登録を廃止）

#### 3.2.2 介護施設一覧

**変更点**:
- 施設グループの表示を追加
- 表示頻度設定の表示を追加

---

## 4. サービス提供者ポータルの変更

### 4.1 機能の整理

#### 提供する機能
- ✅ レセプト/明細のアップロード
- ✅ アップロード履歴の確認
- ✅ 投稿したデータの確認
- ✅ 紐づけ施設の確認

#### 提供しない機能（削除）
- ❌ 利用明細の確認 → セルフィッシュから出力
- ❌ 決済状況詳細 → セルフィッシュから出力
- ❌ 売上レポート → セルフィッシュから出力

### 4.2 画面変更

#### 4.2.1 ダッシュボード

**変更後**:
```
┌─────────────────────────────────────────────────────┐
│ ダッシュボード                                       │
├─────────────────────────────────────────────────────┤
│ 今月のアップロード件数: 45件                         │
│ 最終アップロード: 2026/2/27 14:30                   │
├─────────────────────────────────────────────────────┤
│ 【最近のアップロード】                               │
│ 2/27 14:30 - ○○施設 - 15件 - 決済完了              │
│ 2/26 10:15 - △△施設 - 8件 - 決済完了               │
├─────────────────────────────────────────────────────┤
│ ※ 利用明細・売上レポートはセルフィッシュから         │
│   提供されます                                       │
└─────────────────────────────────────────────────────┘
```

#### 4.2.2 アップロード画面

**変更点**:
- アップロード完了後、即時決済を実行
- 決済結果（成功/失敗）を表示
- 失敗時のエラーメッセージを表示

**アップロードフロー**:
```
ファイル選択
    ↓
データ検証
    ↓
アップロード
    ↓
即時決済（USEN PSP）
    ↓
結果表示
    ├── 成功: 「決済が完了しました」
    └── 失敗: 「決済に失敗しました: [エラー内容]」
```

#### 4.2.3 アップロード履歴

**表示項目**:
- アップロード日時
- 対象施設
- 件数
- 合計金額
- 決済ステータス（成功/失敗）

---

## 5. 介護施設ポータルの変更

### 5.1 入居者登録フロー

#### 変更前（4ステップ）
```
Step 1: 入居者情報 → Step 2: 家族情報 → Step 3: カード登録 → Step 4: 確認
```

#### 変更後（3ステップ）
```
Step 1: 入居者情報 → Step 2: アカウント登録 → Step 3: 確認
```

**Step 2: アカウント登録の詳細**:
```
┌─────────────────────────────────────────────────────┐
│ Step 2: アカウント登録                               │
├─────────────────────────────────────────────────────┤
│ アカウント種別を選択してください:                     │
│ [👤 入居者本人] [👥 家族]                            │
├─────────────────────────────────────────────────────┤
│ ■ 入居者本人を選択した場合                          │
│   通知方法: (●)LINE ( )メール ( )郵送              │
│   決済担当: [✓]                               │
├─────────────────────────────────────────────────────┤
│ ■ 家族を選択した場合                                │
│   氏名: [____________]                              │
│   続柄: [配偶者 ▼]                                  │
│   電話: [____________]                              │
│   メール: [____________]                            │
│   通知方法: (●)LINE ( )メール ( )郵送              │
│   通知を受け取る: [✓]                               │
│   決済担当: [ ]                               │
├─────────────────────────────────────────────────────┤
│ [+ アカウントを追加]                                 │
├─────────────────────────────────────────────────────┤
│ 登録済みアカウント:                                  │
│ 1. 👤 山田太郎（入居者）- LINE - 決済担当     │
│ 2. 👥 山田花子（娘）- メール                        │
├─────────────────────────────────────────────────────┤
│ ⚠️ 決済担当は1人だけ指定してください           │
│                                                     │
│ [戻る] [次へ]                                       │
└─────────────────────────────────────────────────────┘
```

### 5.2 入居者詳細画面

#### 「家族情報」タブ → 「アカウント」タブに変更

```
┌─────────────────────────────────────────────────────┐
│ 入居者詳細: 山田太郎                                 │
├─────────────────────────────────────────────────────┤
│ [基本情報] [アカウント] [明細] [設定]               │
├─────────────────────────────────────────────────────┤
│ 【アカウント一覧】                    [+ 追加]      │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ 👤 山田太郎（入居者本人）                       │ │
│ │    通知: LINE                                   │ │
│ │    決済担当: ✅                           │ │
│ │    カード: ⚠️ 未登録                           │ │
│ │    ステータス: 招待済み                         │ │
│ │    [編集] [削除]                                │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 👥 山田花子（娘）                               │ │
│ │    通知: メール                                 │ │
│ │    通知受信: ✅                                 │ │
│ │    決済担当: −                            │ │
│ │    ステータス: 有効                             │ │
│ │    [編集] [削除]                                │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ ℹ️ カード登録は決済担当本人が自身のデバイスで  │
│    行います                                         │
└─────────────────────────────────────────────────────┘
```

### 5.3 設定画面

#### 表示頻度設定を追加

```
┌─────────────────────────────────────────────────────┐
│ 施設設定                                            │
├─────────────────────────────────────────────────────┤
│ 【表示頻度】                                        │
│ 入居者への明細表示頻度を選択してください:           │
│                                                     │
│ (●) 月1回（月末にまとめて表示）                     │
│     └ シンプルに管理したい場合におすすめ           │
│                                                     │
│ ( ) 月2回（15日と月末に分けて表示）                 │
│     └ リアルタイムで把握したい場合におすすめ       │
│                                                     │
│ [保存]                                              │
└─────────────────────────────────────────────────────┘
```

### 5.4 削除する機能

- ❌ 入居者登録時のカード登録ステップ
- ❌ 入居者詳細からのカード登録/変更ボタン

---

## 6. ユーザーポータルの変更

### 6.1 URL変更

**変更前**: `/family`  
**変更後**: `/user`

### 6.2 ログイン後の分岐

```typescript
// ログイン後の表示ロジック
if (!account.cardToken && account.isBillingPerson) {
  // カード未登録の決済担当 → カード登録モーダル表示
  showCardRegistrationModal();
}
```

### 6.3 ホーム画面

#### 挨拶の出し分け

```typescript
// 入居者本人の場合
"こんにちは、山田太郎さん"

// 家族の場合
"こんにちは、山田花子さん（山田太郎さんのご家族）"
```

#### カード未登録警告（決済担当のみ）

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ カードが登録されていません                        │
│ 自動決済を利用するには、カード登録が必要です         │
│ [カードを登録する]                                   │
└─────────────────────────────────────────────────────┘
```

### 6.4 カード画面

#### 決済担当の場合

```
┌─────────────────────────────────────────────────────┐
│ 💳 カード管理                                       │
├─────────────────────────────────────────────────────┤
│ ■ カード未登録の場合                                │
│ ┌─────────────────────────────────────────────────┐ │
│ │         💳                                      │ │
│ │                                                 │ │
│ │  カードを登録して                               │ │
│ │  自動決済を始めましょう                         │ │
│ │                                                 │ │
│ │  [カードを登録する]                             │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ■ カード登録済みの場合                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │  Visa ••••1234                                  │ │
│ │  有効期限: 12/28                                │ │
│ │  登録日: 2026/02/15                             │ │
│ │                                                 │ │
│ │  [カードを変更する]                             │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 決済担当でない場合

```
┌─────────────────────────────────────────────────────┐
│ 💳 カード管理                                       │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ ℹ️ あなたは決済担当ではありません          │ │
│ │                                                 │ │
│ │ 決済担当: 山田太郎さん（入居者本人）       │ │
│ │                                                 │ │
│ │ カードの登録・変更は決済担当が            │ │
│ │ 行います。                                      │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 6.5 設定画面

#### 決済担当表示を追加

```
┌─────────────────────────────────────────────────────┐
│ ⚙️ 設定                                             │
├─────────────────────────────────────────────────────┤
│ 【アカウント情報】                                   │
│ 氏名: 山田花子                                      │
│ 種別: 家族（娘）                                    │
│ 決済担当: いいえ                              │
│                                                     │
│ 【通知設定】                                        │
│ 通知方法: メール                                    │
│ メールアドレス: hanako@example.com                  │
│ 明細通知: [✓] 受け取る                              │
│ 支払いエラー通知: [✓] 受け取る                      │
│                                                     │
│ [保存]                                              │
└─────────────────────────────────────────────────────┘
```

---

## 7. 外部連携の実装

### 7.1 USEN PSP連携

#### 7.1.1 カード登録（トークン化）

```typescript
// カード登録フロー
async function registerCard(accountId: string): Promise<void> {
  // 1. USEN PSPの登録画面にリダイレクト
  const redirectUrl = await usenPsp.getCardRegistrationUrl({
    returnUrl: `${BASE_URL}/user/card/callback`,
    accountId: accountId,
  });
  
  // 2. リダイレクト
  window.location.href = redirectUrl;
}

// コールバック処理
async function handleCardCallback(token: string, accountId: string): Promise<void> {
  // 3. トークンを保存
  await db.residentAccount.update({
    where: { id: accountId },
    data: {
      cardToken: token,
      cardBrand: tokenInfo.brand,
      cardLast4: tokenInfo.last4,
      cardExpiryMonth: tokenInfo.expiryMonth,
      cardExpiryYear: tokenInfo.expiryYear,
      cardRegisteredAt: new Date(),
    },
  });
}
```

#### 7.1.2 即時決済（オーソリ）

```typescript
// レセプトアップロード時の即時決済
async function processImmediatePayment(statementId: string): Promise<PaymentResult> {
  const statement = await db.statement.findUnique({ where: { id: statementId } });
  const account = await db.residentAccount.findFirst({
    where: { residentId: statement.residentId, isBillingPerson: true },
  });
  
  if (!account?.cardToken) {
    return { success: false, error: 'カードが登録されていません' };
  }
  
  // USEN PSP APIを呼び出し
  const result = await usenPsp.authorize({
    token: account.cardToken,
    amount: statement.amount,
    merchantCode: statement.facility.merchantCode,
    mallCode: statement.facility.mallCode,
    orderId: statement.id,
  });
  
  // 結果を保存
  await db.statement.update({
    where: { id: statementId },
    data: {
      paymentStatus: result.success ? 'authorized' : 'failed',
      authorizedAt: result.success ? new Date() : null,
      transactionId: result.transactionId,
      paymentErrorCode: result.errorCode,
      paymentErrorMessage: result.errorMessage,
    },
  });
  
  // 入居者・家族に通知
  if (result.success) {
    await notifyPaymentSuccess(statement);
  } else {
    await notifyPaymentFailure(statement, result.errorMessage);
  }
  
  return result;
}
```

### 7.2 セルフィッシュ連携

#### 7.2.1 加盟店番号登録

```typescript
// 加盟店審査承認時にセルフィッシュに登録
async function registerToSelfish(merchantCode: string, providerInfo: any): Promise<void> {
  // セルフィッシュAPIを呼び出し（仕様は別途確認）
  const result = await selfishApi.registerMerchant({
    merchantCode: merchantCode,
    // その他必要な情報
  });
  
  if (result.success) {
    await db.serviceProvider.update({
      where: { merchantCode },
      data: {
        selfishRegistered: true,
        selfishRegisteredAt: new Date(),
      },
    });
  }
}
```

---

## 8. バッチ処理の実装

### 8.1 集計バッチ

#### 実行タイミング
- **15日 23:59** - 1日〜15日分の集計
- **月末 23:59** - 16日〜月末分の集計

#### 処理内容

```typescript
// 集計バッチ処理
async function runAggregationBatch(year: number, month: number, period: '1H' | '2H'): Promise<void> {
  const batch = await db.aggregationBatch.create({
    data: {
      year,
      month,
      period,
      status: 'processing',
      startedAt: new Date(),
    },
  });
  
  try {
    // 対象期間の決済済み明細を集計
    const startDate = period === '1H' 
      ? new Date(year, month - 1, 1) 
      : new Date(year, month - 1, 16);
    const endDate = period === '1H' 
      ? new Date(year, month - 1, 15, 23, 59, 59) 
      : new Date(year, month, 0, 23, 59, 59);
    
    const statements = await db.statement.findMany({
      where: {
        paymentStatus: 'authorized',
        authorizedAt: { gte: startDate, lte: endDate },
        aggregatedAt: null,
      },
    });
    
    // 明細に集計期間を設定
    await db.statement.updateMany({
      where: { id: { in: statements.map(s => s.id) } },
      data: {
        aggregationPeriod: period,
        aggregatedAt: new Date(),
      },
    });
    
    // バッチ完了
    await db.aggregationBatch.update({
      where: { id: batch.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        totalAmount: statements.reduce((sum, s) => sum + s.amount, 0),
        transactionCount: statements.length,
      },
    });
    
  } catch (error) {
    await db.aggregationBatch.update({
      where: { id: batch.id },
      data: {
        status: 'failed',
        errorMessage: error.message,
      },
    });
  }
}
```

### 8.2 施設表示頻度に応じた明細表示

```typescript
// 施設の表示頻度設定に応じて明細を取得
async function getStatementsForDisplay(facilityId: string, year: number, month: number): Promise<Statement[]> {
  const facility = await db.facility.findUnique({ where: { id: facilityId } });
  
  if (facility.displayFrequency === 'monthly') {
    // 月1回: 月末にまとめて表示（1H + 2H）
    return db.statement.findMany({
      where: {
        facilityId,
        aggregationPeriod: { in: ['1H', '2H'] },
        // 年月でフィルタ
      },
    });
  } else {
    // 月2回: 期間ごとに分けて表示
    return db.statement.findMany({
      where: {
        facilityId,
        // 指定された期間でフィルタ
      },
    });
  }
}
```

---

## 9. 実装優先順位

### Phase 1: 基盤（必須）

| # | タスク | 重要度 | 工数目安 |
|---|--------|-------|---------|
| 1 | データモデル変更（マイグレーション） | 高 | 2日 |
| 2 | アカウント種別（self/family）対応 | 高 | 2日 |
| 3 | 決済担当機能 | 高 | 1日 |
| 4 | USEN PSP連携（即時決済） | 高 | 3日 |

### Phase 2: ポータル変更

| # | タスク | 重要度 | 工数目安 |
|---|--------|-------|---------|
| 5 | 介護施設ポータル: 入居者登録フロー変更 | 高 | 2日 |
| 6 | 介護施設ポータル: アカウントタブ | 高 | 1日 |
| 7 | ユーザーポータル: URL変更（/family → /user） | 中 | 0.5日 |
| 8 | ユーザーポータル: カード画面変更 | 高 | 1日 |
| 9 | サービス提供者ポータル: 機能削減 | 中 | 1日 |

### Phase 3: 運営機能

| # | タスク | 重要度 | 工数目安 |
|---|--------|-------|---------|
| 10 | 加盟店申請フォーム（公開） | 高 | 2日 |
| 11 | 加盟店申請管理画面 | 高 | 2日 |
| 12 | セルフィッシュ連携（加盟店番号登録） | 高 | 1日 |
| 13 | 施設グループ管理 | 中 | 1日 |
| 14 | 表示頻度設定 | 中 | 1日 |

### Phase 4: バッチ・集計

| # | タスク | 重要度 | 工数目安 |
|---|--------|-------|---------|
| 15 | 集計バッチ実装 | 高 | 2日 |
| 16 | 集計バッチ管理画面 | 中 | 1日 |

**合計工数目安**: 約23日

---

## 10. チェックリスト

### 10.1 データモデル

- [ ] MerchantApplication エンティティ追加
- [ ] FacilityGroup エンティティ追加
- [ ] Facility に groupId, merchantCode, mallCode, displayFrequency 追加
- [ ] ServiceProvider に applicationId, merchantCode, mallCode 追加
- [ ] ResidentAccount に type, isBillingPerson 追加
- [ ] Statement に paymentStatus, transactionId, aggregationPeriod 追加
- [ ] AggregationBatch エンティティ追加

### 10.2 運営者ポータル

- [ ] 加盟店申請管理画面（一覧・詳細・承認・却下）
- [ ] 施設グループ管理画面
- [ ] 集計バッチ管理画面
- [ ] サービス提供者一覧に加盟店番号表示追加
- [ ] 介護施設一覧に表示頻度設定表示追加

### 10.3 サービス提供者ポータル

- [ ] ダッシュボードから利用明細関連を削除
- [ ] アップロード時に即時決済を実行
- [ ] 決済結果の表示
- [ ] 「利用明細はセルフィッシュから」の案内表示

### 10.4 介護施設ポータル

- [ ] 入居者登録を4ステップから3ステップに変更
- [ ] アカウント種別選択（入居者本人/家族）
- [ ] 決済担当指定（1人のみ）
- [ ] 「家族情報」タブを「アカウント」タブに変更
- [ ] カード登録ボタンを削除
- [ ] 「カード登録は本人が行う」案内表示
- [ ] 表示頻度設定画面追加

### 10.5 ユーザーポータル

- [ ] URL変更（/family → /user）
- [ ] 挨拶の出し分け（入居者本人/家族）
- [ ] カード未登録時のモーダル表示（決済担当のみ）
- [ ] ホームにカード未登録警告（決済担当のみ）
- [ ] カード画面の出し分け（決済担当/非決済担当）
- [ ] 設定画面に決済担当表示

### 10.6 外部連携

- [ ] USEN PSP: カード登録（リダイレクト/コールバック）
- [ ] USEN PSP: 即時決済（オーソリ）
- [ ] セルフィッシュ: 加盟店番号登録API

### 10.7 バッチ処理

- [ ] 集計バッチ（15日/月末実行）
- [ ] 表示頻度に応じた明細表示ロジック

### 10.8 通知

- [ ] 決済成功通知（入居者・家族）
- [ ] 決済失敗通知（入居者・家族）

---

## 補足

### API仕様の確認待ち

| 連携先 | 確認事項 | 担当 |
|--------|---------|------|
| USEN PSP | API仕様書、テスト環境 | USEN |
| セルフィッシュ | 加盟店番号登録API仕様 | セルフィッシュ担当者 |

### 今後の検討事項

1. 決済失敗時のリトライ処理
2. カード有効期限切れ時の対応
3. 決済担当変更時のフロー
4. 入居者退去時のアカウント処理

---

**以上**
