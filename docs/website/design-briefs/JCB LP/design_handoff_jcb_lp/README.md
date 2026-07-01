# Handoff: JCB総合窓口LP — 案A「シティホテル・ラウンジ」

## Overview
JCBカードホルダー向けDMから誘導する**ライフサポート総合窓口LP**（1カラム・縦長ランディングページ）。
高齢のカードホルダー本人およびそのご家族に、住まい・健康・資産管理を一括相談できる「QOLC」サービスの価値を伝え、**無料相談フォームへの送客**をゴールとする。

採用デザイン方向：**案A「シティホテル・ラウンジ」** — ネイビー基調、写真メイン、和モダンなラウンジの情景で「人のぬくもり」と高級感・信頼感を演出。

## About the Design Files
このバンドル内の `index.html` / `styles.css` は **HTMLで作成したデザインリファレンス（プロトタイプ）** です。見た目と意図した挙動を示すもので、そのまま本番コードとしてコピーするものではありません。

実装タスクは、**このHTMLデザインを、対象コードベースの既存環境（Next.js / React / Vue / WordPress 等）の確立されたパターン・コンポーネント・ライブラリを用いて再現する**ことです。まだ環境がない場合は、プロジェクトに最適なフレームワークを選定して実装してください。

## Fidelity
**High-fidelity（ハイファイ）**。最終的な配色・タイポグラフィ・余白・インタラクションを含むピクセル単位のモックです。下記トークンと数値に忠実に、既存のライブラリ／パターンで再現してください。

---

## Design Tokens

### Colors
| 用途 | 変数 | HEX |
|---|---|---|
| メインネイビー | `--navy` | `#1B2A4A` |
| ダークネイビー（背景・スクリム） | `--navy-deep` | `#0F1D36` |
| ネイビー（明） | `--navy-light` | `#2A3D62` |
| ゴールド（アクセント／CTA） | `--gold` | `#C4A265` |
| ゴールド（明） | `--gold-light` | `#D4B87A` |
| ゴールド（淡・アイコン地） | `--gold-pale` | `#F5EFE0` |
| グリーン（ヘッダーCTA／信頼） | `--green` | `#4C986A` |
| グリーン（濃・hover） | `--green-deep` | `#3D7A55` |
| クリーム（ページ地） | `--cream` | `#FAF8F4` |
| クリーム（温・予備） | `--cream-warm` | `#F5F0E8` |
| 本文インク | `--ink` | `#1B2A4A` |
| 補助テキスト | `--ink-soft` | `#41506b` |

配色比率の目安：**Navy 70 / Gold 20 / Cream 10**。グリーンはヘッダーCTAと「ご相談無料」系の限定的アクセントのみ。

### Typography
- 見出し（h1〜h3, ブランド名, ロゴ）：`"Noto Serif JP", serif` — weight 700（h1のみ大）
- 本文・UI：`"Noto Sans JP", "Inter", system-ui, sans-serif` — weight 400 / 500 / 700
- 英字ラベル（eyebrow等）：`"Inter", "Noto Serif JP", serif` — weight 500, `letter-spacing:3px`, `text-transform:uppercase`, 13px
- Google Fonts: `Inter:400,500,700` / `Noto Sans JP:300,400,500,700,900` / `Noto Serif JP:300,500,700`

| 要素 | size | weight | line-height | 備考 |
|---|---|---|---|---|
| body | 17px（SP 16px） | 400 | 1.8 | シニア配慮で大きめ・行間広め |
| hero h1 | `clamp(34px,5.4vw,62px)` | 700 | 1.32 | letter-spacing .02em |
| hero-sub | `clamp(16px,1.6vw,20px)` | 400 | 1.9 | |
| section h2 | `clamp(27px,3.6vw,40px)` | 700 | 1.45 | |
| svc-card h3 | 21px | 700 | | |
| eyebrow | 13px | 500 | | gold, uppercase, 3px tracking |

### Spacing / Layout
- コンテナ最大幅：`--maxw: 1180px`、左右パディング `--pad: clamp(20px,5vw,64px)`
- セクション縦パディング：`clamp(64px,9vw,110px)`
- セクション見出し下マージン：`clamp(40px,6vw,64px)`
- グリッド間隔：サービス/お悩み/お約束カードは `gap: 20〜24px`

### Border radius
- ボタン 6px / カード（svc）14px / お悩みカード 10px / フローカード 14px / ロゴ 9px / バッジ・チップ 999px（pill）

### Shadows
- カードhover：`0 18px 40px -22px rgba(27,42,74,.35)`
- お悩みカード：`0 8px 26px -20px rgba(27,42,74,.4)`
- フローカード：`0 10px 30px -24px rgba(27,42,74,.5)`

### Buttons
| クラス | 背景 | 文字 | 用途 |
|---|---|---|---|
| `.btn-gold` | `#C4A265` | `#0F1D36` | 主CTA「無料でご相談する」 |
| `.btn-green` | `#4C986A` | `#fff` | ヘッダー「ご相談」 |
| `.btn-ghost` | 透明＋白枠 | `#fff` | （写真上の副次） |
- 共通：`min-height:52px`（ヘッダーCTAは44px）, `padding:0 28px`, `font-weight:700`, 17px。hover で `translateY(-1px)` ＋ 明色化、`.arrow` が右に3px移動。
- **タップ領域は最低44px**（シニア配慮・必須）。

---

## Screens / Views

単一ページ・縦スクロール。上から順に以下のセクション。

### 1. Header（sticky）
- 固定ヘッダー、高さ72px。`background:rgba(250,248,244,.86)` ＋ `backdrop-filter:blur(12px)`、下境界 `1px rgba(27,42,74,.08)`。
- 左：ロゴ（42px角丸9px・ネイビーグラデ地にゴールドの「Q」）＋ ブランド名「QOLC」（Serif 19px）＋ サブ「ライフサポート総合窓口 / JCB × Universal Development」（11px）。
- 右：`.btn-green` 「ご相談」（44px, 15px）。

### 2. Hero
- `min-height:88vh`、下寄せレイアウト（`align-items:flex-end`）。白文字。
- 背景：`.hero-photo`（写真・後述）＋ `.hero-photo::after` に多層スクリム（下方向グラデ rgba(13,26,49,.52→.95)＋左下/右上のラジアル）で可読性確保。
- 見出し横の `.amp`（「確かな安心」）はゴールド。h1/hero-sub に `text-shadow` を付与。
- バッジ「JCBカードホルダー様 限定ご案内」：pill、ゴールド枠＋ドット、`backdrop-filter:blur(6px)`。
- コピー：
  - H1: 「将来の暮らしに<br>確かな安心を。」（"確かな安心" のみゴールド）
  - sub: 「住まい・健康・資産管理まで。<br>専任コンシェルジュが、ワンストップでご支援します。」
  - CTA: 「無料でご相談する →」＋ 補足「所要時間 約2分 ・ 秘密厳守」

### 3. Trust bar
- 背景 `--navy`、白文字。中央寄せの3項目（ゴールドのドット付）：「ご相談無料」「秘密厳守」「専任コンシェルジュ対応」。

### 4. Services「4つのライフサポート」
- 背景 `--cream`。中央見出し（eyebrow "Our Support"）。
- 2×2グリッド（`gap:24px`、SPは1列）。各 `.svc-card`：白地、`1px rgba(196,162,101,.28)` 枠、radius14px、padding `38px 34px`。左にゴールド丸アイコン（60px・ストロークSVG）、右に h3＋説明。hoverで `translateY(-4px)`＋影。
- 4項目：シニアレジデンスのご紹介／在宅ライフサポート／相続・資産管理のご相談／住み替え・リフォーム。

### 5. Worry / Empathy「こんなお悩み、抱えていませんか。」
- 背景 白。`.worry-card`：白地、左ボーダー `4px gold`、radius10px、ゴールドの菱形マーカー。
- 5枚（最後の1枚は `grid-column:1/-1` で全幅）。下に主CTA「まずは無料でご相談する →」。

### 6. Flow「ご相談の流れ」3ステップ
- 背景 `--cream`。`.flow-step` 縦並び。左にネイビー丸番号（56px・Serif・ゴールド数字）、右に h3＋説明。
- フォームで共有 → コンシェルジュ連絡 → 最適プラン提案。

### 7. Promise「安心のお約束」
- 背景 白。4カラム（SP1列）。`.promise-ico`：74px丸・ネイビー地・ゴールドSVG。
- 個人情報保護／完全無料／専任対応／JCB提携。

### 8. Final CTA
- フルブリード写真＋ `rgba(15,29,54,.88)` スクリム、中央寄せ白文字。eyebrow "Contact"、h2「まずはお気軽に<br>ご相談ください。」、ゴールドCTA（min-width280px）。

### 9. Footer
- 背景 `--navy-deep`。上段：ブランド「JCB × Universal Development」（×がゴールド）＋タグline＋リンク（プライバシーポリシー／特商法／会社概要）。下段：コピーライト＋運営会社表記。

---

## Interactions & Behavior
- **スムーススクロール**：ヘッダー/ヒーローCTAは `#form`（Final CTA）へアンカー遷移（`scroll-behavior:smooth`）。
- **hover**：ボタンは浮き上がり＋明色化、`.arrow` 右移動。カードは浮き上がり＋影（transition .2〜.25s ease）。
- **フォーム**：本プロトタイプにフォーム本体は未実装（CTAは送客先プレースホルダ）。実装側で別途、約2分で完了する短いステップ式の相談フォーム（チェック選択中心）を用意する想定。バリデーションは必須項目最小限。
- **レスポンシブ**：
  - `≤768px`：サービス/お悩み/お約束グリッドを1列化、trust barを縦並び、フッター縦積み。
  - `≤430px`：ヘッダーのサブ文言を非表示、ヒーローCTA群を縦並び・全幅化。

## State Management
本LPは原則静的。必要な状態は実装フレームワークに依存（フォーム導入時のみ入力値・送信状態・バリデーションエラーを管理）。

## Accessibility（必須・ブリーフ準拠）
- 本文最小16px、行間1.8、タップ領域44px以上。
- 写真上テキストはスクリム＋text-shadowでコントラスト確保（WCAG AA目標）。
- 装飾SVGは `aria-hidden`。配色は高齢者を想定し高コントラスト維持。

## Assets
- アイコンはすべてインラインSVG（lucide系のストロークアイコン、`stroke-width:1.6`、24×24 viewBox）。外部依存なし。
- 写真は**差し替え前提のイメージ**（Unsplash）。本番は**オリジナル撮影推奨**。
  - Hero: `images.unsplash.com/photo-1604328698692-f76ea9498e76`（和モダンなラウンジ／人物あり）
  - Final CTA: `images.unsplash.com/photo-1551882547-ff40c63fe5fa`
- フォント：Google Fonts（Inter / Noto Sans JP / Noto Serif JP）。

## Files
- `index.html` — 案A の完全なLP（自己完結リファレンス）。
- `styles.css` — 案A用に整理したスタイルシート（CSS変数＝デザイントークンを冒頭に定義）。

> 備考：プロジェクト本体（`JCB LP/`）には A/B/C を切り替えられる `jcb-lp.html` と一覧 `overview.html` もありますが、本ハンドオフは**採用案A**のみを対象にしています。
