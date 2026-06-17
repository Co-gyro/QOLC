# Vercelデプロイ手順（JCB加盟店申請フォームを園田さんに試用してもらう / 2026-06-17）

## 目的
JCBから依頼された加盟店申請手続きを、運営センターの「加盟店申請フォーム」
（`/admin/merchant-application`）で**園田さんが自分のブラウザから**入力し、
JCB用Excel（EC版・店頭版）を出力できるようにする。

## 前提（確認済み）
- 申請フォームは**100%クライアント側処理**。サーバーAPI・DB・USEN決済は不要（入力→Excel生成→ブラウザDL）。
- `npm run build` 本番ビルド**通過済み**（`/admin/merchant-application` 266kB で生成OK）。
- ただしフォームは `/admin/` 配下＝**adminログインの内側**。園田さんはログインが必要。
- ログインは**メール＋パスワードのみ**（このテスト用adminアカウントはMFA未強制）。

---

## 手順A：Vercelダッシュボードでデプロイ（推奨・確実）

1. https://vercel.com にログイン（UDのVercel Proアカウント）
2. **Add New… → Project → Import Git Repository**
3. `Co-gyro/QOLC` を選択（GitHub連携が初回なら承認）
4. Framework は **Next.js** が自動検出される（Build/Outputはデフォルトのまま）
5. **Environment Variables** に以下4つを登録（値は `.env.vercel.local` からコピペ）：
   | 変数名 | 値の出所 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `.env.vercel.local` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.vercel.local` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `.env.vercel.local` |
   | `NEXT_PUBLIC_APP_URL` | 初回は仮で可。デプロイ後にVercel発行URLへ更新 |
   - USEN_* 系は**登録不要**（このフォームでは使わない。決済は別途）。
6. **Deploy** をクリック → 数分でビルド完了 → `https://qolc-xxxx.vercel.app` が発行される
7. （任意）発行URLを `NEXT_PUBLIC_APP_URL` に設定し直して Redeploy（リダイレクト整合のため）

> Vercel上の `next build` が走る。ローカルで通過済みなので基本そのまま成功する想定。

### 手順B：Vercel CLI（ダッシュボードが使えない場合）
```
npx vercel            # 初回はブラウザでログイン
npx vercel env add NEXT_PUBLIC_SUPABASE_URL       # 以下4変数を投入
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel env add NEXT_PUBLIC_APP_URL
npx vercel --prod
```

---

## 園田さんへの案内（当日渡す内容）★2026-06-17 デプロイ後の実態に更新

> デプロイされた `main` ブランチには認証(middleware/login)が無いため、**ログイン不要**でフォームが開けます。
> 他のadminページ(payments/merchants/dashboard)はmainに存在せず404になるので、情報露出の心配もありません。

1. URL（**これ1つだけ渡せばOK・ログイン不要**）:
   **`https://qolc-lkz7.vercel.app/admin/merchant-application`**
2. フォームに加盟店情報を入力
   - セクション3で要入力：**契約コード（JCB付与6桁）/ POS支店コード(TID 13桁)/ 包括加盟店使用番号（モールコード・任意）**
   - 包括事業者コードは `0160` 固定で自動設定される
5. 下部の **「JCB EC版 Excelダウンロード」**（必要なら「店頭版」も）→ Excelが手元に保存される
6. そのExcelがJCB提出用フォーマット

---

## デプロイ対象ブランチ（確認済み）
- GitHubリモート名は **`GitHub`**（`origin`ではない）。リポジトリ `Co-gyro/QOLC`。
- **`main`・`develop` どちらにも申請フォームあり**。ローカル`develop`はGitHubと同期済み（未pushなし）。
- Vercelインポート時のProduction Branchは **`main`** で可（フォーム含む）。最新UI込みで見せたい場合は `develop` を選ぶ。

## 注意・申し送り
- このデプロイは**テスト用Supabase（fxcgclgoopjgaopawgiw）**を指す。`admin@qolc.test` はこのプロジェクトのアカウント。
- 公開URLにログイン画面が晒される点に留意（テスト環境・実決済なし）。試用が終わったらVercel側でデプロイを停止/削除してよい。
- 将来は Phase1 計画どおり「加盟店申請フォーム（公開・ログイン不要 `/(marketing)/apply`）」に発展させると、園田さんはログイン不要になる。
- 秘密情報は `.env.vercel.local`（gitignore済み・コミットされない）にのみ存在。この手順書には値を書かない。
