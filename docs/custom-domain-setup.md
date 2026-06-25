# 本番ドメイン app.qolc.jp 紐付け手順

最終更新: 2026-06-25

QOLC本体アプリ（Vercel `qolc-app`）を `qolc-app.vercel.app` から独自ドメイン `app.qolc.jp` へ移行する手順。
ドメインは お名前.com 保有（無料）。**コード変更は不要**（URLはすべて `NEXT_PUBLIC_APP_URL` 起点で組み立てられ、LINEコールバックも自動追従する）。env と外部コンソール設定のみ。

> 切替は「DNS反映 → アプリenv更新 → 外部サービス（LINE）許可リスト更新」の順。順序を誤るとLINEログイン/LIFFが一時的に弾かれるため、**メンテ時間帯に実施**推奨。

---

## 影響範囲（`NEXT_PUBLIC_APP_URL` が効く箇所）
- LINEログイン redirect_uri 組立（`src/lib/line/config.ts`）
- 家族招待リンク（`/api/facility/invitations`）
- カード登録 prepare の baseUrl（`/api/payment/card/prepare`）
- 領収書PDFのフォント参照（`src/lib/pdf/receipt-generator.ts`）

---

## 手順

### 1. Vercel にカスタムドメイン追加
1. Vercel → プロジェクト `qolc-app` → Settings → Domains → `app.qolc.jp` を Add
2. Vercelが提示する DNS レコード（通常 `CNAME app → cname.vercel-dns.com`）を控える

### 2. お名前.com で DNS 設定
1. お名前.com Navi → DNS → `qolc.jp` のDNSレコード設定
2. ホスト名 `app`、TYPE `CNAME`、VALUE `cname.vercel-dns.com`（Vercel提示値）を追加
3. 反映待ち（数分〜最大数時間）。Vercel Domains画面が `Valid Configuration` になればOK
4. SSL証明書はVercelが自動発行（Let's Encrypt）

### 3. アプリ env 更新（Vercel Production）
```
NEXT_PUBLIC_APP_URL=https://app.qolc.jp
```
- `NEXT_PUBLIC_*` はビルド時埋め込みのため、変更後 **Redeploy 必須**
- `LINE_LOGIN_REDIRECT_URI` を明示設定している場合は `https://app.qolc.jp/api/auth/line/callback` に更新（未設定ならAPP_URLから自動組立されるので不要）

### 4. LINE Developers コンソール更新
1. **LINE Login チャネル**（client_id 2010492408）→ Callback URL に
   `https://app.qolc.jp/api/auth/line/callback` を**追加**（既存の vercel.app は移行確認まで残置）
2. **LIFF**（LIFF ID `2010492408-6x5mecN4`）→ Endpoint URL を
   `https://app.qolc.jp/liff` に更新
3. リッチメニューの各ボタンリンク（`https://liff.line.me/2010492408-6x5mecN4?next=...`）は
   LIFF ID 経由のため**変更不要**（Endpoint URL更新で自動追従）

### 5. 疎通確認
- [ ] `https://app.qolc.jp` がアプリを表示（SSL緑）
- [ ] PC: `/login` のLINEログイン → コールバック成功
- [ ] スマホ: LINEリッチメニュー → LIFF（マイページ）が新ドメインで開く
- [ ] 家族招待リンクが `app.qolc.jp` で発行される
- [ ] 領収書PDFのフォントが正しく埋め込まれる（文字化けしない）

### 6. 後片付け
- 全疎通確認後、LINE Login の旧 `*.vercel.app` Callback URL を削除（任意）
- ブックマーク・各種共有リンクの差し替え案内

---

## ロールバック
- env `NEXT_PUBLIC_APP_URL` を `https://qolc-app.vercel.app` に戻して Redeploy
- LINE Callback/LIFF Endpoint も旧URLへ戻す（旧URLを残置しておけば即時復帰可能）

関連: [operations-runbook.md](operations-runbook.md) / [deploy-vercel-merchant-form-20260617.md](deploy-vercel-merchant-form-20260617.md)
