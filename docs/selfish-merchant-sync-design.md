# QOLC → Selfish 加盟店登録連携 設計メモ

作成: 2026-09-16
対象: 審査通過・USEN開通後に「Selfish（精算システム）へ支払先を登録する」作業の自動化
関連: Obsidian `Selfish/Selfish_QOLC連携仕様.md`（2026-08-24 決定事項）、
Selfish リポジトリ `/Users/project/selfish-web`（`docs/ACCESS-MIGRATION.md`, `docs/INVARIANTS.md`）

---

## 1. 結論（先に読む）

- **方式**: QOLC が「Selfish 登録データ」を組み立てて **Selfish へ push**（`POST /api/partners/merchants`、冪等キー = QOLC `merchants.id`）。
  8/24 合意どおり。以降の口座・料率の変更は Selfish が正、QOLC は初回登録のみ渡す。
- **対応キー（未決だったもの）**: **QOLC `merchants.id`（UUID）= Selfish `merchants.external_id`**。
  QOLC 加盟店 1 件 = Selfish 法人 1 件 + 店舗 1 件を自動生成（店舗名 = 加盟店名）。
  法人の下に複数店舗を束ねたいケースは Selfish 側で手動統合（QOLC は法人階層を持たない）。
- **QOLC 側で先に直すもの（DDL 不要・`ud_input` 追記で足りる）**: 銀行コード/支店コード、口座番号 7 桁、口座名義の全銀半角カナ、料率適用開始日。セゾンは「加盟店No.(7桁) + 店舗No.(既定 0000001)」で連結し、初回の実 CSV で答え合わせする。
  現状の QOLC は「銀行名・支店名（文字列）」しか持たず、Selfish の口座テーブル（4 桁+3 桁コード必須）に**そのままでは入らない**。
- **段階導入**: ①QOLC に「Selfish 登録票」画面（手作業でも転記ミスをなくす）→ ②Selfish に JSON 取込画面（貼り付け・差分プレビュー）→ ③API 接続。②と③は同じ取込モジュールを使うので追加コストが小さく、連携停止時のフォールバックにもなる。

---

## 2. 現状

### 2.1 いまの手順（業務 OS ワークフロー「加盟店申請」）

| seq | 工程 | データの置き場 |
|---|---|---|
| 8 | 審査結果の登録 | `applications.ud_input.review.{jcb,saison}` |
| 9 | QOLC へ加盟店番号を登録 | `merchants.jcb_merchant_code_recurring / _ec / saison_merchant_code` |
| **10** | **セルフィッシュへ支払先を登録** | **完全手作業**（Selfish 画面で 法人→店舗→口座→加盟店番号→料率 の 5 画面を入力） |
| 11 | USEN 側の登録確認（テスト決済） | — |

seq 10 のガイド文「支払先番号は JCB が 9 桁、セゾンは加盟店 No.」は **Selfish の実装と食い違っている**。
Selfish は支払先番号（UD 自身の包括番号）をマスタ照合に使っておらず、明細を店舗に突合するキーは
**店子ごとの加盟店番号（JCB 14 桁 / セゾン 加盟店 No.7 桁 + 加盟店店舗 No.7 桁）**。
→ ガイド文の修正が必要（§5）。

### 2.2 Selfish が登録時に要求する項目（`selfish-web/supabase/migrations/0002_masters.sql`）

```
merchants            name(必須), external_id(UNIQUE, QOLC 連携用に予約済み)
merchant_stores      merchant_id, name(必須), email, delivery_channel(email|qolc_portal|selfish_portal), status
merchant_accounts    store_id(UNIQUE=1 店舗 1 口座), bank_code(4 桁), branch_code(3 桁),
                     account_type(1|2|4|9), account_number(1〜7 桁), account_name_kana(全銀半角カナ)
merchant_card_numbers store_id, card_brand_id(JCB|SAISON), merchant_number  ※UNIQUE(card_brand_id, merchant_number)
fee_schedules        merchant_card_number_id, valid_from(必須), merchant_fee_rate(必須),
                     card_company_fee_rate(必須), agent_*, nm_*, monthly_fixed_fee1..3  ※期間重複は DB が拒否
```

検証ルールは `apps/web/src/lib/masters/rules.ts` に一元化されている（zod 不使用）。
口座名義カナは「変換すれば通る」場合に**黙って変換せず運用者承認を待つ**（`account-name.ts`）。
マスタ全テーブルに監査行トリガ。`audit_logs.actor_type='api:qolc'` と `import_files.source_method='qolc_api'` が**予約席として既に存在**するが、外部からの受信 API は 1 本もない。

### 2.3 QOLC が開通時点で持っているもの

| Selfish 項目 | QOLC の在処 | 状態 |
|---|---|---|
| 法人名 | `merchants.name`（申請 payload の `corpName`） | ○ |
| 法人 external_id | `merchants.id` | ○ |
| 店舗名 | `merchants.name` または payload `facilityName` | ○ |
| 店舗メール | payload `contactEmail` | ○（連絡担当者のメール。明細配信先として妥当か要確認） |
| 配信チャネル | なし | △ 当面 `email`。QOLC ポータル配信（トラック C2）稼働後に `qolc_portal` へ |
| 銀行コード / 支店コード | **なし**（`ud_input.bank_name / bank_branch` は名称のみ） | **×** |
| 口座種別 | `ud_input.account_type`（ordinary/checking） | ○ 1/2 へ写像 |
| 口座番号 | `ud_input.account_number`（4〜8 桁許容） | △ Selfish は 7 桁まで。zod を 7 桁に合わせる |
| 口座名義カナ | `ud_input.account_holder`（自由文字列 60 字） | **×** 全銀半角カナ検証なし |
| JCB 加盟店番号（14 桁） | `merchants.jcb_merchant_code_recurring` / `jcb_merchant_code_ec`（通常同値） | ○ 重複を除いて全部送る（下記） |
| セゾン 14 桁（加盟店 No.7 + 店舗 No.7） | `merchants.saison_merchant_code`（7 桁 = 審査結果の加盟店No.。実例 2077994） | △ 店舗 No. は既定 `0000001` で連結（`SAISON_DEFAULT_STORE_NO`）。初回 CSV で答え合わせ（warning 表示） |
| 加盟店手数料率 | `ud_input.settlement_rate`（% 文字列 例 "1.9"） | ○ `percentTextToRateText` 相当で 0.019000 へ |
| カード会社手数料率 | **なし** | × UD 側の値。Selfish のブランド別既定値で埋める（§4.3） |

#### JCB の加盟店番号は DB 上 2 列ある（2026-09-16 整理）

migration `032` は「審査結果で発番される 2 種（登録型 / 都度型EC）」と明記しているが、
**2026-09-16 の JCB 回答で「販売形態区分 11 の加盟店番号 1 本で登録型・都度型を包含」に変わった**
（commit `507d977a`）。QOLC の編集画面は 1 つの入力を両列へ保存する。
ただし過去分・例外で 2 列が異なる値を持つ可能性は残るので、連携は次の規則にする。

- `jcb_merchant_code_recurring` と `jcb_merchant_code_ec` を集めて**重複を除いた集合**を `card_numbers` に載せる（同値なら 1 件、異なれば 2 件）。
- Selfish は明細を `merchant_card_numbers` で店舗に結びつけるため、**QOLC が持つ JCB 番号は全部送る**。外れた売上は `unmatched_sales` に隔離され、その店子への入金が手作業解決まで止まる。
- Selfish 側は 1 店舗に同一ブランドの番号を複数ぶら下げられる（`UNIQUE (card_brand_id, merchant_number)` のみ）。
- `fee_schedules` は加盟店番号ごとに作る。ペイロードの `fee` は 1 つで、**Selfish 側で `card_numbers` の件数分に展開**する。

| 料率適用開始日 | なし | △ 開通確認日（seq 11 完了日）を既定にする |

---

## 3. 方式の比較

| 案 | 内容 | 評価 |
|---|---|---|
| A. 登録票（手作業補助） | QOLC が Selfish の入力順に整形した「登録票」を表示。運用者が転記 | すぐ作れる。転記ミス減。自動化ではない |
| B. JSON 取込（半自動） | A の JSON を Selfish の取込画面に貼る。差分プレビュー→適用 | 認証設計不要。銀行マスタ取込と同じ型 |
| **C. API push（自動）** | QOLC のボタン → Selfish `POST /api/partners/merchants`（HMAC + IP 制限） | 8/24 合意。C の受信処理 = B の取込モジュール |
| D. Selfish が QOLC DB を直接読む | 別 Supabase を service-role で参照 | 結合が強く監査が二重化。不採用 |

**A → B → C の順で積む。** B の「検証・差分・適用」を `apps/web/src/lib/masters/merchant-import.ts` として純関数化しておけば、C の Route Handler はそれを呼ぶだけ。

---

## 4. 連携データ仕様（案）

### 4.1 ペイロード（QOLC → Selfish）

```jsonc
{
  "schema": "qolc.merchant.v2",
  "external_id": "<QOLC merchants.id (uuid)>",
  "merchant": { "name": "医療法人〇〇会" },
  "store": {
    "name": "〇〇クリニック",
    "email": "contact@example.jp",
    "delivery_channel": "email"          // 当面固定。C2 稼働後 "qolc_portal"
  },
  "account": {
    "bank_code": "0310", "branch_code": "102",
    "account_type": "1",                 // ordinary→1 / checking→2
    "account_number": "1234567",         // 7 桁以内（左 0 埋めは Selfish 側で行わない）
    "account_name_kana": "ｲﾘﾖｳﾎｳｼﾞﾝ ﾏﾙﾏﾙｶｲ"  // 全銀文字のみ。QOLC 側で事前検証
  },
  // QOLC が持つ加盟店番号を**重複を除いて全部**載せる（§2.3）。
  // JCB は区分11の1本化で recurring と ec が同値になるので通常1件。
  // 過去分・例外で2列が異なる値のときだけ2件になる。
  // 載せ漏らした番号の売上は突合できず unmatched_sales に落ちる。
  "card_numbers": [
    { "brand": "JCB",    "merchant_number": "24111748400001" }, // 14 桁
    { "brand": "SAISON", "merchant_number": "20772470000001" }  // 加盟店No.7 + 店舗No.7
  ],
  "fee": {
    "valid_from": "2026-10-01",
    "merchant_fee_rate": "0.019000",     // 文字列。浮動小数を経由しない（Selfish 不変条件）
    // カード会社手数料率も **QOLC が送る**（2026-09-16 決定。下記）
    "card_company_fee_rates": { "JCB": "0.030000", "SAISON": "0.032000" }  // v2: ブランド別（card_numbers に載せたブランドの分が必須）
    // fee は1つだけ送り、**Selfish 側で card_numbers の件数分に展開**する
    //（fee_schedules は加盟店番号ごとにぶら下がるため）
  },
  "source": { "application_id": "<applications.id>", "opened_at": "2026-09-30" }
}
```

### 4.2 冪等・更新ルール

- `external_id` で `merchants` を upsert。店舗は「その法人の唯一の店舗」を対象にする（**`merchant_stores.external_id` 列の追加を推奨**。将来 1 法人多店舗になっても突合が壊れない）。
- 口座は 1 店舗 1 口座（DB 制約）。既存と異なれば **UPDATE**、同じなら書かない（監査を汚さない）。
- 加盟店番号は `UNIQUE(card_brand_id, merchant_number)`。他店舗に既登録なら **409 で店舗 ID を返し**、QOLC 側に表示する。
- 料率は既存期間と重なる場合 **新規追加しない**（Selfish の GiST 制約で失敗する）。初回登録のみ作成し、改定は Selfish 画面で行う（正は Selfish）。
  料率は **`card_numbers` の件数だけ**作る（JCB 1 件＋セゾン 1 件なら 2 行）。
  一部の番号にだけ既存期間があるケースがあるため、**番号ごとに独立して判定する**
  （「1 件でも重なれば全部やめる」にすると、JCB だけ登録済みのときセゾンが永久に入らない）。
- 口座名義カナが「変換すれば通る」場合は **`needs_approval` で返し、登録を保留**。QOLC 側で名義を直して再送する（Selfish 側で黙って変換しない）。
- 監査は `actor_type='api:qolc'`。
  **操作者メールは `actor_id` に入らない。** `audit_logs.actor_id` は **uuid 型**で、
  QOLC の操作者は Selfish の `auth.users` に存在しない。当初「`actor_id` = 操作者メール」と
  書いていたが実装不可能。しかも監査トリガは `request.jwt.claims->>'sub'` を uuid へ
  キャストし、失敗したら**例外を握りつぶして NULL に落とす**ので、
  間違って渡しても誰も気づけない。内訳は次のとおり:

  | 列 | 入れるもの |
  |---|---|
  | `actor_type` | `'api:qolc'` |
  | `actor_id` | **NULL**（QOLC の操作者に対応する Selfish のユーザーが無い） |
  | `correlation_id` | `X-Qolc-Request-Id`。QOLC 側の `application_events` と突合する |
  | `digest` | `{ operator_email, qolc_merchant_id, request_id, ... }` |

  ※ `correlation_id` が付くのは**サービス層が明示 INSERT した行だけ**。
  マスタ行変更の自動記録（`audit_row_change()`）には付かない（Selfish `lib/auth/actor.ts` の既知の制限）。
  突合は「同一 request-id の明示行の `occurred_at` を手掛かりに前後の自動記録を辿る」運用になる。

### 4.3 カード会社手数料率は QOLC が送る（2026-09-16 決定）

当初は「Selfish がブランド別の既定値を持って補う」としていたが、
**この料率は業種によって加盟店ごとに違い、既定値というものが無い**。
ブランド別に1つ持たせると、全社一律の誤った値が黙って入る。

そこで **`ud_input.card_company_fee_rate_jcb` / `card_company_fee_rate_saison` として QOLC でブランド別に入力し、ペイロード `fee.card_company_fee_rates` に載せる**（2026-09-16 v2。UD→カード会社の率は JCB とセゾンで異なるため 1 欄では表現できない。旧の共通欄 `card_company_fee_rate` は暫定値として読むだけ）。
加盟店手数料率（`settlement_rate`）と同じ性質・同じタイミング・同じ人が決める値なので、
入力欄を隣に並べる。Selfish 側は**必須項目**として扱い、無ければ登録を拒否する
（既定値で埋めない。埋めると誤りに誰も気づけない）。

#### この料率が効く範囲（誤入力したときに何が壊れるか）

`packages/settlement/src/fees.ts`:

```
支払金額   = 売上金額合計 − 加盟店手数料              ← カード会社手数料は入らない
売上手数料 = 加盟店手数料 − カード会社手数料 − 代理店手数料  ← UD/NM按分の原資
```

**店子への振込額には影響しない。** 効くのは UD 自身の取り分と NM との折半、
および支払報告書の内訳。誤送金にはならないが UD の P&L を誤って表示する。

ただし**料率行が1件も無いと集計そのものが落ちる**
（「締日時点で有効な手数料設定が登録されていません」）ので、登録は必須。

#### 業種コードで引く案を採らなかった理由

QOLC の業種は `ud_input.biz_overview`（JCB 申請書用の自由記述・256字）で
コード化されていない。業種別マスタを引くには QOLC に業種コードを新設し、
対応表を維持する必要がある。店子が増えて一覧性が要るようになったら再検討する。

- NM 手数料・UD 固定費・代理店：API では触らない（NULL / false / 0）。必要な店子は Selfish で設定。

### 4.4 認証・経路（実装済み契約・2026-09-16）

QOLC 側の実装: `src/lib/selfish/signature.ts`（署名）/ `src/lib/selfish/client.ts`（送信）。
Selfish 側はこの契約どおりに `POST /api/partners/merchants` を実装する。

| 項目 | 値 |
|---|---|
| エンドポイント | `POST {SELFISH_API_BASE_URL}/api/partners/merchants`（`Content-Type: application/json`） |
| 共有鍵 | QOLC `SELFISH_PARTNER_KEY` = Selfish `QOLC_PARTNER_KEY`（両方 env・ログ出力禁止） |
| ヘッダ | `X-Qolc-Timestamp`（UNIX 秒）/ `X-Qolc-Request-Id`（UUID）/ `X-Qolc-Signature`（hex 小文字） |
| 署名対象 | `${timestamp}\n${requestId}\n${rawBody}`（改行 LF 区切り。rawBody は受信バイト列そのまま） |
| 署名 | `HMAC-SHA256(key, 署名対象)` の hex。`tests/selfish/signature.test.ts` に参照値の往復テストあり |
| 受信側の検証 | 時刻ずれ ±300 秒 / request-id の再利用拒否（Selfish 側で記録） / `timingSafeEqual` で比較 |
| タイムアウト | QOLC 側 15 秒。超過は失敗として記録（再送は運用者がボタンを押し直す。冪等なので安全） |
| IP 制限 | 当面なし（Vercel の固定 IP が無いため） |

**応答規約**（QOLC `client.ts` がこの形を読む）

```jsonc
// 2xx
{ "ok": true, "result": "created" | "updated" | "unchanged", "merchant_id": "<uuid>", "store_id": "<uuid>" }
// 4xx / 5xx
{ "ok": false, "code": "needs_approval" | "conflict" | "validation" | "unauthorized" | "...", "message": "日本語の説明", "details": { } }
```
- `needs_approval`: 口座名義カナが「変換すれば通る」状態。Selfish は登録せず候補を `details` に返す。QOLC は 409 として運用者に表示する
- `conflict`: 加盟店番号が他店舗に登録済み。`details.store_id` を返す
- QOLC は成功・失敗とも `application_events`（`selfish_registered` / `selfish_failed`）と `activity_logs` に request-id 付きで記録する。Selfish 側の `audit_logs.actor_type='api:qolc'` と request-id で突合できる

**運用**: `SELFISH_API_BASE_URL` / `SELFISH_PARTNER_KEY` が QOLC に未設定の間は「Selfish へ登録」ボタンが無効になり、登録票の JSON をコピーして Selfish の取込画面（案 B）へ貼る。

---

## 5. QOLC 側の作業一覧（2026-09-16 実装済み。残は運用設定のみ）

DDL が不要なものを優先。`ud_input` は JSONB なので列追加は zod と画面だけで済む。
実装: `src/lib/selfish/`（zengin / build-payload / signature / client / load-source）、
`src/app/api/admin/merchants/[id]/selfish/route.ts`（GET=登録票 / POST=送信）、
`src/app/admin/merchants/_components/selfish-dialog.tsx`、`src/components/applications/ud-bank-fields.tsx`、
migration `035_update_workflow_selfish_step.sql`（要 SQL Editor 適用）。
残作業: Vercel に `SELFISH_API_BASE_URL` / `SELFISH_PARTNER_KEY` を投入（Selfish 側 API 完成後）。

1. **`ud_input` に振込先コードを追加**: `bank_code`(4 桁) / `branch_code`(3 桁)。
   画面（`src/components/applications/ud-input-form.tsx`）に入力欄を足し、`src/lib/applications/ud-input.ts` の zod に regex を追加。
   銀行名・支店名は JCB/セゾン申請書用に残す。
2. **口座番号を 7 桁上限に**: `account_number` の regex を `^\d{1,7}$` へ（Selfish の CHECK と一致）。
3. **口座名義を全銀半角カナで検証**: `account_holder` に Selfish `rules.ts` と同じ集合 `^[0-9A-Z()\/\-. ｦｰ-ﾟ]+$` を適用（小書きカナ ｯｬｭｮ は集合外＝大書きへ）。全角→半角の変換候補を画面で提示し、運用者が確定した値だけ保存する（Selfish の承認方式に揃える）。
4. **セゾン加盟店番号の定義を確定**: `merchants.saison_merchant_code`（7 桁）は既存 UI の意味どおり「**セゾン審査結果の加盟店No.**（店子ごとに発番。実例 ランサイド = 2077994）」。店舗 No. は 1 店舗運用の既定 `0000001` を定数で補い、送信時に 7+7 で連結する（内訳を `parts` に同送）。
   ※初回の店子分セゾン売上 CSV で「加盟店No.」「加盟店店舗No.」列の実値と一致するか答え合わせする。ずれていれば `SAISON_DEFAULT_STORE_NO` か QOLC の保存定義を直す。
5. **料率適用開始日**: `ud_input.fee_valid_from`（YYYY-MM-DD）。未入力時は seq 11（USEN 開通確認）の完了日を既定に使う。
6. **Selfish 登録票の画面**（案 A）: `/admin/merchants` の行アクションに「Selfish 登録データ」ダイアログ。§4.1 の JSON と、不足項目のチェックリスト（銀行コード未入力など）を表示。コピーできるようにする。
   データの組み立ては純関数 `src/lib/selfish/build-payload.ts` に置き、テストを付ける。
7. **ワークフロー seq 10 のガイド文を修正**（`supabase/migrations/030_create_workflow_engine.sql` のシードは適用済みなので、`workflow_templates` を UPDATE する新 migration）:
   「支払先番号 9 桁 / 7 桁」→「店子の加盟店番号（JCB 14 桁・セゾン 加盟店 No.7 桁+店舗 No.7 桁）。QOLC の『Selfish 登録データ』から転記する」。
   seq 10 を seq 11（開通確認）の後ろへ移すかは運用判断（開通前に登録しても害はない。料率開始日だけ後決めになる）。
8. **案 C の送信ボタン**: seq 10 のカードに「Selfish へ登録」ボタン。前提条件（加盟店番号 2 社・口座コード・名義カナ・料率）が揃うまでは無効化し、不足項目を表示する（ボタンを隠さない）。
   結果を `application_events`（kind=`selfish_registered`）と `activity_logs` に記録。

## 6. Selfish 側の作業一覧（2026-09-16 API まで実装済み）

実装: migration `0012_qolc_sync.sql` / `0013_partner_requests.sql`、
`apps/web/src/lib/masters/merchant-import.ts`（検証＋差分計算・純関数）、
`apps/web/src/lib/partners/{qolc-signature,qolc-import}.ts`、
`apps/web/src/app/api/partners/merchants/route.ts`、`src/proxy.ts`（受信APIの除外）。
テスト: 単体 863件 / E2E 147件 / packages/db 151件。
**Selfish 側の実装は完了**。残るのは運用開始前の設定（下記）のみ。

1. ✅ `merchant_stores.external_id`（UNIQUE, NULL 可）と `merchants.external_id` の列コメント訂正（0012）。
2. ✅ `card_brands.default_card_company_fee_rate`（0012）。**NULL=未設定**で 0 を既定にしない。
   未設定のあいだ連携は料率を作らず `missing_default_rate` で保留する。
3. ✅ `merchant-import.ts`（検証 → 差分計算）。DBは触らない純関数で、案B・案Cが同じ判定を通る。
4. ✅ 取込画面 `masters/merchants/import`（案 B）: JSON 貼り付け → 差分プレビュー → 適用。
   **連携が止まったときのフォールバック**なので、API が動いていても要る。
   加盟店一覧の「QOLC連携データから取込」から開く（管理者のみ）。
   判定は API と同じ関数を通す（画面だけ緩いと抜け道になる）。
   確認トークンは貼り付けた JSON と差分要約の両方から作り、
   確認から実行までの間に別の利用者が取り込んでいれば拒否する。
   **監査の名義は `api:qolc` ではなく操作した運用者**（画面から押したのは
   Selfish の利用者であって QOLC ではない。同じ名義にすると
   「誰が手で取り込んだか」が監査ログから消える）。
5. ✅ `POST /api/partners/merchants`（案 C）。再送防止は `partner_requests`（0013）。
   HMAC は「本文と時刻」に対する署名で**何回送られたかは分からない**ため、
   ±300 秒の判定だけでは再送を素通しする。request-id を処理の前に記録して一意制約で弾く。
6. ✅ `.env.example` に `QOLC_PARTNER_KEY`。`QOLC_BASE_URL` は引き続き**設定しない**
   （`/providers/<id>` が QOLC 側に無く 404 になる。§7）。

### 運用開始前に必ず要る設定 — **2026-09-16 完了**

| 設定 | 状態 |
|---|---|
| Selfish: migration 0012 / 0013 / 0014 を本番適用 | ✅ `verify-supabase.mjs` 全項目クリア（業務テーブル27＋schema_migrations=28） |
| Selfish: `QOLC_PARTNER_KEY`（Vercel Production） | ✅ 投入・再デプロイ済み |
| QOLC: `SELFISH_PARTNER_KEY`（同じ値）/ `SELFISH_API_BASE_URL` | ✅ 投入・再デプロイ済み |
| QOLC: migration `035_update_workflow_selfish_step.sql` | ⬜ **SQL Editor で手動適用が必要**（CLI 未リンク） |

※ QOLC 本番は **`develop` ブランチから配信**されている（`main` は 155 コミット遅れ）。
`main` へのマージは不要。

### 本番で確認したこと（2026-09-16）

`POST /api/partners/merchants` に実際に署名して送り、次を確認した。

| 送ったもの | 結果 |
|---|---|
| 署名なし | 401 `unauthorized`（理由は返さない） |
| 鍵違い | 401 |
| 時刻ずれ（+600秒） | 401 |
| 正しい署名 + 空JSON | 400 `validation`（版違いを指摘）＝鍵が通っている |
| 同じ request-id で2回 | 1回目 400 / 2回目 409 `duplicate_request` |
| 実データと同じ形のペイロード | **200 `created`**（法人・店舗・口座・加盟店番号・料率を登録） |
| 同じ内容を別 request-id で再送 | 200 `unchanged`（二重登録しない。料率は期間重複で skip） |

疎通確認に使った `【疎通確認】` のデータは `scripts/cleanup-smoke.mjs` で削除済み
（監査ログは追記専用のため残る）。

## 7. 決めておくこと（推奨値つき）

| 論点 | 推奨 |
|---|---|
| external_id は何の ID か | QOLC `merchants.id`。法人まとめは Selfish で手動 |
| 店舗メール | 申請の `contactEmail`。明細の宛先が別なら `ud_input.statement_email` を追加 |
| 配信チャネル初期値 | `email`（C2 稼働まで） |
| カード会社手数料率の持ち主 | Selfish（ブランド別既定値） |
| 料率の開始日 | USEN 開通確認日。手入力で上書き可 |
| セゾン 7 桁の意味 | 審査結果の加盟店No.（店舗 No. は既定 0000001。要・初回答え合わせ） |
| JCB 番号を何件送るか | 2 列（登録型・都度型EC）を**重複除去して全部**。区分11の1本化後は通常1件 |
| 連携失敗時 | 案 B の貼り付け取込にフォールバック（8/24「連携が止まっても精算は自走」） |


### 4.5 v2 変更点（2026-09-16・カード会社手数料率のブランド別化）

- `schema` は `qolc.merchant.v2`。Selfish は v1 を「版が違う」として拒否してよい（本番に v1 の実登録は無い）。
- `fee.card_company_fee_rate`（単一）→ `fee.card_company_fee_rates: { JCB?: string, SAISON?: string }`。
  `card_numbers` に載せた各ブランドのキーが必須。載せていないブランドのキーは無くてよい（あっても無視）。
- Selfish 側の展開: 各 `card_numbers[i]` に対し `fee_schedules` を 1 行作り、`card_company_fee_rate` は `fee.card_company_fee_rates[card_numbers[i].brand]` を使う。`merchant_fee_rate` と `valid_from` は共通。
- QOLC 側: UD追記情報の欄を JCB/セゾンの 2 欄に分割。加盟店管理の一覧に「料率（精算 / カード会社）」列を追加し、入力済みかを一覧で確認できる。旧の共通欄に値が残る申請は暫定値として送り warning を表示。
