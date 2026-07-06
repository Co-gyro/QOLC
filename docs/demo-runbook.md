# QOLC デモ手順書（お客様説明用）

最終更新: 2026-07-06

介護施設向け決済SaaS QOLC の一連の流れ（明細アップロード → その他費用の合算 → 決済 → 領収書）を
お客様に説明するためのデモ手順。**テストモード**（USEN TSJM／実課金なし）で動作する。

---

## 1. 起動

```bash
cd /Users/project/QOLC
npm run dev    # http://localhost:3000
```

> 本番カード決済を伴わないデモはテストモードのまま実施する。`.env.local` は TSJM/TSJL（テスト）。
> 本番値に切り替えている場合は `cp .env.local.prod_backup_* .env.local` を戻さず、テスト用に戻してから実施。

### ⚠️ テストモードは env 切替だけでは不十分（2026-07-06 判明）

決済のモールコードは env ではなく **DB の `merchants.mall_code`** から取られる（受注コード採番も同様）。
テストモードで決済まで通すには、次の**3点セット**が必要:

1. `.env.local` を TSJL/TSJM に切替（site鍵/mall鍵/GROUP_ID/トークンJS URLも全部テスト値に）
2. デモ加盟店の `mall_code` を `TSJM` に変更（例: テスト診療所 `69fd9433-…`）。**デモ後は `A300` に戻す**
3. カード会員は**サイト単位**。本番(S203)で登録した会員はテスト(TSJL)に存在しないため、
   `resident_accounts.usen_member_id` を一旦 NULL にして `/user/card` から**テストカード
   `4100000000000100` / CVV 123 / 08-2027 / TESTCARD** で登録し直す
   （member_id はアカウントIDから決定的に導出されるため、再登録後も同じ値に戻る＝本番側に影響なし）

いずれかが欠けると `与信失敗 (code=05)` になる（TSJL鍵×A300モールの不整合等）。

## 2. デモ用アカウント（パスワード末尾 #2026）

| 役割 | URL | ログイン |
|---|---|---|
| 運営センター | /admin/dashboard | admin@qolc.test / QolcAdmin#2026 |
| サービスステーション（提供者） | /provider/dashboard | provider@qolc.test / QolcProvider#2026 |
| 施設ステーション | /facility/dashboard | facility@qolc.test / QolcFacility#2026 |
| マイページ（家族） | /user/home | family@qolc.test / QolcFamily#2026 |

- 提供者「テスト診療所」は施設「テスト介護施設」と連携済み。
- デモ入居者（テスト介護施設）: 山田テスト / 鈴木花子 / 佐藤次郎。
- 山田テストはカード登録済み（テストカードで会員ID保持）。

## 3. デモ用サンプルファイル

| 用途 | ファイル |
|---|---|
| ① 介護レセプト（保険分） | `…/Desktop/3 Step Up/介護施設向けSaaS/レセプト/KS202604通所介護.csv` |
| ② その他費用（保険外） | `test-data/sample-other-cost.csv` |

`sample-other-cost.csv` の中身（被保険者番号で各入居者に合算される）:

```
被保険者番号,その他費用,10%対象,8%対象
0001325455,145859,66235,29624   ← 山田テスト
0000005678,98000,70000,28000    ← 鈴木花子
0000009999,50000,,              ← 佐藤次郎（税内訳なし）
```

---

## 4. デモの流れ（提供者ポータル）

`provider@qolc.test` でログイン → **明細アップロード**（/provider/upload）

### シナリオA: 保険＋その他費用の合算（メイン）
1. **① 明細・レセプト** に `KS202604通所介護.csv` を投入
   → プレビューに山田テスト **¥17,464**（保険本人負担）が出る
2. **② その他費用（保険外）** に `sample-other-cost.csv` を投入
   → 山田テストが **¥163,323**（保険17,464 ＋ その他145,859）に更新
3. **アップロード履歴** の行をクリック → 入居者別の内訳（保険分／その他費用の区分）と状態を確認
4. **決済を実行** → 入居者ごと1決済で合算課金（テストモール、実課金なし）
5. マイページ／決済管理から **領収書PDF** を表示
   → 「保険内サービス」「その他費用(保険外)」を**区分表示**、合計＝決済額、軽減税率10%/8%内訳

### シナリオB: 順不同・その他費用のみ（柔軟性の説明）
- **② だけ**を先に投入 → その他費用のみのまとめが作れる
- **② → ①** の順でも同じまとめに合算される（順不同）
- ① の枠にその他費用CSVを誤投入しても、種別を自動判定して正しく処理（金額0の誤バッチは作られない）

### 状態の見方（履歴）
- **取込み中** … ファイル取込み中（自動で確認待ちへ）
- **確認待ち** … 取込み済み・決済前（追加投入や決済実行が可能）
- **決済完了** … 決済実行済み（領収書発行可）
- **エラー** … 取込み失敗（形式を確認し再アップロード）

---

## 5. デモ後のリセット

決済を実行すると payments が作られる（テストモードなので実課金はない）。
デモ用に作ったバッチ・決済を消したい場合は運営に依頼するか、サービスロール経由で
該当 upload_batch を削除する（statement_service_details → statement_lines → payments → upload_batches の順）。

> ⚠️ **決済実行済み（監査ログあり）の payments は物理削除できない**。`payment_audit_logs` は
> service role でも DELETE 不可（改ざん防止）で、FK により payments → upload_batches の削除が連鎖的に
> ブロックされる。消せるのは決済未実行（preview）のバッチのみ。決済まで実行したデモデータは残る前提で運用する。

### テストモード → 本番復旧の手順

```bash
cp .env.local.prod_backup_YYYYMMDD .env.local   # env を本番値へ
# Supabase SQL Editor: UPDATE merchants SET mall_code='A300' WHERE id='69fd9433-5f2c-4359-bf56-1637e75aa048';
```

> 恒久的な「いつでも見せられるデモURL」が必要な場合は、Vercel のステージング環境に
> テストモードでデプロイする方法を別途用意できる（[deploy-vercel-merchant-form-20260617.md](deploy-vercel-merchant-form-20260617.md) 参照）。

## 関連
- 領収書フォーマット: [receipt-processing-design.md](receipt-processing-design.md)
- 運用Runbook: [operations-runbook.md](operations-runbook.md)
- アップロード形式: [qolc-upload-format.md](qolc-upload-format.md)
