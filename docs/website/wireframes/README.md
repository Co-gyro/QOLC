# Webサイト ワイヤーフレーム — 開発引き継ぎガイド

## 概要

QOLC関連の3サイトのワイヤーフレームHTML。Coworkで設計・デザイン済み。
VS Code + Claude Code で本番サイトへの実装に移行する。

**Netlifyプレビュー**: https://bright-jelly-2f3f70.netlify.app
- [JCB LP](https://bright-jelly-2f3f70.netlify.app/jcb-lp-wireframe)
- [QOLCプロモ](https://bright-jelly-2f3f70.netlify.app/qolc-promo-wireframe)
- [UD企業サイト](https://bright-jelly-2f3f70.netlify.app/ud-corporate-wireframe)

---

## ファイル構成

```
wireframes/
├── index.html                    ← 3サイト共通インデックス
├── jcb-lp-wireframe.html         ← JCB総合窓口LP
├── qolc-promo-wireframe.html     ← QOLCプロモーションサイト
├── ud-corporate-wireframe.html   ← UDコーポレートサイト
├── README.md                     ← このファイル
│
├── [画像アセット]
│   ├── UDlogo.png                ← UDロゴ
│   ├── QOLC_rogo2.png            ← QOLCロゴ
│   ├── QOLC_concept.png          ← QOLCコンセプト画像
│   ├── QOLC_concept2.png
│   ├── QOLC_concept_transparent.png
│   ├── qolc_top_image1.png       ← QOLCトップ画像
│   ├── top-greeting.png          ← UD代表者写真
│   ├── payment_service_1.jpg     ← 決済代行サービス写真
│   ├── Management_Consulting1.jpg ← コンサルティング写真
│   ├── ASP1.jpg                  ← ASPサービス写真
│   ├── nursing1.png              ← 介護施設写真
│   ├── concierge_1.png / concierge_2.png ← コンシェルジュ写真
│   ├── Family1.png               ← 家族写真
│   ├── keiri-bucho.png           ← 経理部長ペルソナ
│   ├── musuko1.png               ← 息子ペルソナ
│   ├── worries1.png              ← お悩み写真
│   │
│   └── [パートナーロゴ]
│       ├── JCB_logo.svg.webp
│       ├── 20250228_usen_fintech_img01.jpg  ← USEN
│       ├── saison_brand_logo.jpg             ← セゾン
│       └── lifecard_index_im_xx02.webp       ← ライフカード

wireframes-deploy/                ← Netlifyデプロイ用（最適化済み画像含む）
design-briefs/                    ← デザインブリーフ（設計仕様書）
├── 00_共通デザイン方針.md
├── 01_JCB_LP_デザインブリーフ.md
├── 02_QOLC_プロモサイト_デザインブリーフ.md
└── 03_UD_コーポレートサイト_デザインブリーフ.md
```

---

## 各サイトの仕様サマリー

### 1. JCB総合窓口LP (`jcb-lp-wireframe.html`)

**目的**: JCBカード会員の介護施設利用者家族向けコンシェルジュサービスLP
**サービス名**: QOLCの安心相談窓口 by JCB
**ターゲット**: JCBカード会員で介護施設に親族がいる方
**デザイン方向**: ラグジュアリー＋安心感（ダークネイビー基調、ゴールドアクセント）

**ページ構成**:
- ヒーロー（コンシェルジュ写真＋CTA）
- こんなお悩みありませんか？
- Solution（3つの強み）
- 導入事例・お客様の声
- サービス特徴（Features）
- 料金プラン
- 導入の流れ（4ステップ）
- よくある質問（FAQ）
- 加盟店申請フォーム（別ページ）
- フッター

**カラー**: --navy: #1A2744, --gold: #C4A265, --accent: #2E7D96

---

### 2. QOLCプロモサイト (`qolc-promo-wireframe.html`)

**目的**: 介護施設向けにQOLC決済SaaSの導入を促すプロモーションサイト
**ターゲット**: 介護施設の経営者・管理者、事務担当者
**デザイン方向**: 清潔感＋信頼感（QOLCグリーン #4C986A 基調）

**ページ構成**:
- ヒーロー（介護施設写真＋CTA）
- お悩みセクション（3つの課題）
- サービス概要（How it works: 4ステップ）
- 特徴・メリット（Features）
- 料金プラン（施設規模別3プラン）
- ペルソナ別導線（施設管理者/ご家族/事務担当者）
- ヘッダーナビ（ログイン・申請ボタン付き）
- FAQ（カテゴリ別）
- フッター（強化済み）

**カラー**: --primary: #4C986A, --accent: #E8913A, --bg-light: #F0F9F4

**料金プラン**:
- スタートプラン: 月額10,000円（〜30名）
- スタンダード: 月額25,000円（〜80名）
- プレミアム: 月額40,000円（80名〜）
- ※いずれも決済手数料2.5%

---

### 3. UDコーポレートサイト (`ud-corporate-wireframe.html`)

**目的**: ユニバーサル・デベロップメントの企業サイト
**ターゲット**: 取引先、パートナー企業、求職者
**デザイン方向**: 信頼感のあるコーポレート（ネイビー基調）

**ページ構成（5ページ）**:
- トップ（ヒーロー＋サービス概要＋ニュース＋パートナーロゴ）
- 会社概要（会社情報テーブル＋代表メッセージ＋企業理念）
- サービス（4事業：決済代行/QOLC/コンサルティング/ASP提供）
- お問い合わせ（フォーム）
- 法的表記（プライバシーポリシー＋特商法表記）

**ナビゲーション**:
- PC/タブレット: ヘッダーにテキストリンク（会社概要・サービス・お問い合わせ）
- SP: ハンバーガーメニュー（≡ → ✕ アニメーション付き）

**住所**: 〒105-0004 東京都港区新橋1-1-13 アーバンネット内幸町ビル5F
**カラー**: --navy: #1A2744, --accent: #2E7D96

---

## VS Code + Claude Code での実装方針

### Next.js App Router への移行

ワイヤーフレームの各セクションをReactコンポーネントに分解し、QOLCプロジェクトのNext.js構成に組み込む。

ドメイン構成（確定 2026-07-01）: `qolc.jp` を親、JCBを子（`qolc.jp/jcb`）としてパスで内包。
公開サイト（qolc.jp）とアプリ（app.qolc.jp）は1つのNext.jsプロジェクトでVercelに2ドメインを向ける。

```
src/app/
├── (marketing)/           ← QOLCプロモサイト（URL: qolc.jp）
│   ├── page.tsx           ← qolc-promo-wireframe.html → React化
│   ├── service/
│   ├── pricing/
│   ├── apply/             ← 加盟店申請フォーム
│   └── contact/
├── (jcb)/                 ← JCB総合窓口LP（URL: qolc.jp/jcb）
│   └── jcb/page.tsx       ← jcb-lp-wireframe.html → React化
```

UDコーポレートサイトは別ドメイン（uni-dev.jp）なので、
QOLCプロジェクト内では扱わず別途構築する。

### 実装優先順

1. **QOLCプロモサイト** — メインサービスのプロモーション
2. **JCB LP** — パートナー連携の窓口
3. **UD企業サイト** — 別ドメインで構築（優先度低）

### デザインシステムとの連携

ワイヤーフレームで使用しているカラー・フォント・スペーシングは
`QOLC_design_system.html` に定義されたデザイントークンに準拠している。

shadcn/uiコンポーネントにデザイントークンを適用してReact化する。
詳細は `design-briefs/` 内の各デザインブリーフを参照。

### 画像について

- ワイヤーフレームではUnsplash等のストック写真URLを使用
- 一部は `wireframes/` フォルダ内にローカルファイルとして配置済み
- 本番では実際の写真に差し替え予定（パートナーロゴは実物を取得済み）
- 画像最適化: next/image を使用し、WebP変換＋レスポンシブ対応

---

## Netlifyデプロイ手順（ワイヤーフレーム更新時）

1. `wireframes-deploy/` フォルダの内容を更新
2. フォルダをZIPに圧縮
3. https://app.netlify.com/projects/bright-jelly-2f3f70/deploys でアップロード
4. プロジェクト: bright-jelly-2f3f70

---

## 関連ドキュメント

| ドキュメント | 場所 |
|---|---|
| デザインシステム | `QOLC_design_system.html` |
| デザインブリーフ（共通） | `design-briefs/00_共通デザイン方針.md` |
| JCB LPブリーフ | `design-briefs/01_JCB_LP_デザインブリーフ.md` |
| QOLCプロモブリーフ | `design-briefs/02_QOLC_プロモサイト_デザインブリーフ.md` |
| UDサイトブリーフ | `design-briefs/03_UD_コーポレートサイト_デザインブリーフ.md` |
| 要件整理 | `QOLC_要件整理_未決定事項一覧.md` |
| 基本設計方針書 | `QOLC基本設計方針書_v1.0.docx` |
| 開発指示書 | `開発指示書/` フォルダ |
