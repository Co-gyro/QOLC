# Team D: データ処理 — 指示書

**担当**: CSV変換（Phase 0移行）、レセプトデータ解析、PDF生成、アップロード処理API
**ブランチ**: `feat/data-*`
**依存**: Team A の Task A-2（DBスキーマ）完了後にAPI部分を統合。レセプト解析等のロジック単体は先行開発可

---

## CLAUDE.md を必ず最初に読むこと

---

## Task D-1: Phase 0 CSV変換ロジックの移行 ★完了済み — スキップ

> **このタスクは既に完了しています。** CSV変換ロジックはプロジェクト内に実装済みです:
>
> **実装済みファイル:**
> - `src/lib/csv/jcb-rename.ts` — JCB CSVリネーム
> - `src/lib/csv/saison-rename.ts` — セゾン売上明細（リネーム）
> - `src/lib/csv/saison-fi.ts` — セゾン振込情報（集計+PDF読取）
> - `src/lib/csv/saison-fm.ts` — セゾン振込明細（店子集計）
> - `src/lib/csv/naming.ts` — ファイル命名規則
>
> **テスト（8ファイル、51テスト通過済み）:**
> - `tests/csv-naming.test.ts`, `tests/jcb-rename.test.ts`, `tests/saison-fi.test.ts` 等
>
> **関連PDF処理:**
> - `src/lib/pdf/saison-pdf.ts`, `saison-pdf-text.ts`, `saison-pdf-ocr.ts`
>
> **UI（CSV変換ツール画面）:**
> - `src/app/admin/csv-tools/` — JCBリネーム、セゾンUR/FM/FIの4ツール
>
> **→ Task D-2 から開始してください。既存コードは変更しないでください。**

---

## Task D-2: レセプトデータ解析モジュール

```
介護レセコンの伝送用CSVデータを解析するモジュールを作成してください。

【ファイル】 src/lib/receipt/parser.ts

【入力データの仕様】
厚労省標準CSV（interface_kyoutu.pdf 準拠）:
- 文字コード: Shift-JIS
- 改行: CRLF
- 区切り: カンマ
- 値: ダブルクォート囲み

【レコード構造】
- コントロールレコード（type 1）: 事業所番号、データ種別、処理対象年月
- データレコード（type 2）:
  - 7111: 施設サマリー
  - 7131-1: 入居者基本情報（被保険者番号、氏名）
  - 7131-2: サービス明細（サービスコード6桁、回数、単位数）
  - 7131-10: 入居者サマリー（合計単位数、保険給付額、利用者負担額）
- エンドレコード（type 3）

【解析結果の型定義】
interface ReceiptData {
  facilityNumber: string;          // 事業所番号（10桁）
  processingMonth: string;         // 処理対象年月（YYYYMM）
  regionalUnitPrice: number;       // 地域単価（例: 10.21）
  residents: ReceiptResident[];
}

interface ReceiptResident {
  insuranceNumber: string;         // 被保険者番号
  name: string;                    // 氏名
  services: ReceiptService[];
  totalUnits: number;              // 合計単位数
  totalAmount: number;             // 費用総額（= totalUnits × regionalUnitPrice）
  insuranceCoverage: number;       // 保険給付額
  selfPayAmount: number;           // 利用者自己負担額
}

interface ReceiptService {
  serviceCode: string;             // サービスコード（6桁）
  serviceName: string;             // サービス名（マスタから解決）
  count: number;                   // 回数
  units: number;                   // 単位数
}

【テスト】
- 実データ（レセプト/KS202604.xlsx から抽出したCSV）でのパーステスト
- 計算検証: 3,883単位 × 10.21 = 39,645円 が再現できること
- 不正データ（欠損行、文字化け、空ファイル）のエラーハンドリング
- サービスコードマスタとの連携テスト
```

---

## Task D-3: 明細アップロード処理API

```
サービス提供者・施設からの明細CSVアップロードを処理するAPIを実装してください。

【ファイル】 src/app/api/upload/route.ts

【処理フロー】

1. CSVファイルを受信
   - ファイルサイズチェック（上限10MB）
   - MIMEタイプチェック（text/csv, application/octet-stream）
   - 行数チェック（上限10,000行）

2. UploadBatch レコード作成（status: processing）

3. CSVをパース
   - upload_formats テーブルのカラムマッピングに従って解析
   - 各行を StatementLine レコードに変換

4. 入居者マッチング
   【外部提供者の場合】
   - 被保険者番号で、紐づけ済み全施設の入居者を横断検索
   - SQL: SELECT * FROM residents WHERE insurance_number = :csv_value
          AND facility_id IN (
            SELECT facility_id FROM facility_merchant_relations
            WHERE merchant_id = :uploading_merchant_id AND status = 'active'
          )
   - マッチ → facility_id, resident_id を設定
   - マッチなし → match_status: 'unmatched'

   【施設自身の場合】
   - 自施設の入居者のみで検索
   - facility_id は固定

5. UploadBatch を status: preview に更新
6. プレビュー用のレスポンスを返す（施設別→入居者別にグルーピング）

【セキュリティ】
- アップロードファイルはサーバーメモリ上で処理し、ディスクに書かない
- RLS でアップロード者の権限に応じた施設のみにマッチング
- CSVインジェクション対策（= + - @ で始まるセルの無害化）

【テスト】
- 正常系: 10行のCSV → 10件の StatementLine 作成
- マッチング: 3施設に跨るCSV → 施設ごとに正しく分類
- マッチなし: 被保険者番号がDBにない行 → unmatched
- ファイルサイズ超過、不正フォーマットのエラー
- CSVインジェクション攻撃のテスト
```

---

## Task D-4: 領収書PDF生成

```
領収書PDFを自動生成するモジュールを作成してください。

【ファイル】 src/lib/pdf/receipt-generator.ts

【仕様】
- @react-pdf/renderer を使用
- A4サイズ
- 内容:
  - 施設名・住所
  - 入居者名
  - 対象期間
  - サービス明細（提供者名、サービス名、金額）
  - 合計金額
  - 発行日
  - 発行者情報
- フォント: Noto Sans JP（PDFに埋め込み）
- 生成したPDFは Supabase Storage に保存

【テスト】
- PDFが正常に生成されること（バイナリサイズ > 0）
- 日本語テキストが正しくレンダリングされること
- 金額のフォーマット（3桁区切り）
```

---

## 完了条件
- [ ] Phase 0 の全51テストが移行後も通過する
- [ ] レセプトCSVの解析が実データで正しく動作する
- [ ] 明細アップロード→マッチング→プレビューのフローが動く
- [ ] 領収書PDFが日本語で正しく生成される
- [ ] ファイルサイズ制限・CSVインジェクション対策が実装されている
- [ ] ユニットテスト全通過
