# コードレビュー手順書

> Team E（品質・セキュリティ）が、Team A〜D の PR を `develop` へマージする前に行うレビュー手順。

## レビュー対象
- 全 PR（`feat/*` → `develop`）
- 緊急修正 PR（`hotfix/*` → `main`）も同じ手順で

## レビュアー
- 通常: Team E メンバー 1名以上
- `main` マージ: Team E + 他チーム 1名（計2名）

## チェックフロー

### Step 1: CI 通過確認
- [ ] GitHub Actions の `ci.yml` 全ジョブ Green
- [ ] テストカバレッジ 80% 以上
- [ ] `npm audit --audit-level=high` の警告なし

### Step 2: セキュリティチェックリスト
- [ ] [`docs/security/checklist.md`](./checklist.md) の **CRITICAL** 項目すべて
- [ ] 該当カテゴリ（認証/決済/UI 等）の項目

### Step 3: コード品質
- [ ] TypeScript エラー 0、`any` 使用なし
- [ ] 1ファイル 200 行を超えていないか
- [ ] 新規ファイルにテストがあるか
- [ ] JSDoc が主要関数に書かれているか

### Step 4: 設計レビュー
- [ ] 専有ディレクトリの境界を守っているか（他チームの領域を変更していないか）
- [ ] 共通ファイル（`package.json`, `middleware.ts` 等）の変更が妥当か
- [ ] DB マイグレーションが冪等か（`IF NOT EXISTS` 等）
- [ ] RLS ポリシーが新規テーブルに設定されているか

### Step 5: 動作確認
- [ ] PR の Preview Deploy で golden path を実行
- [ ] エラー時の UI 表示が適切か

## レビュー記録

すべて通過したら、`docs/security/reviews/{YYYY-MM-DD}_{branch-name}.md` に記録を残す。

### テンプレート

```markdown
# レビュー記録: feat/foundation-db-schema

- 日付: 2026-05-20
- レビュアー: @user
- PR: #123
- ブランチ: feat/foundation-db-schema → develop

## チェック結果

### Step 1: CI ✅
- ci.yml: passed
- カバレッジ: 85%

### Step 2: セキュリティ ✅
- AUTH-1〜6: 該当なし
- SEC-1〜6: passed
- (略)

### Step 3〜5: ✅

## コメント
- (特になし or 改善提案)

## 結論
**Approve**
```

## マージ後の責任
- レビュアーは `develop` 反映後、Slack #qolc-dev チャンネルへ通知
- 重大な脆弱性が後から見つかった場合は、レビュアーも事後対応に参加
