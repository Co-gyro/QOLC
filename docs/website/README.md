# QOLC 紹介Webサイト 原案（ワイヤーフレーム／デザインブリーフ）

QOLC関連3サイトの紹介Webサイト原案一式。Coworkで設計・デザインした段階のもので、**まだ最終版ではない**。
本番実装（Next.js App Router）へ移行する前の設計資料としてプロジェクト内で管理する。

> 2026-07-01 にリポジトリ直下から `docs/website/` 配下へ集約（3フォルダは相互に相対参照するため兄弟構成のまま移動）。

## 構成

| フォルダ | 内容 |
|---|---|
| [`wireframes/`](./wireframes/) | ワイヤーフレームHTML（JCB LP / QOLCプロモ / UDコーポレート）＋ 画像アセット。詳細は [`wireframes/README.md`](./wireframes/README.md) |
| [`wireframes-deploy/`](./wireframes-deploy/) | Netlifyプレビュー用（画像最適化済み） |
| [`design-briefs/`](./design-briefs/) | 各サイトのデザインブリーフ（設計仕様書）＋ JCB LP デザインハンドオフ |

## 対象サイトと本番実装先（ドメイン構成・確定 2026-07-01）

`qolc.jp` を親（公開サイト）とし、JCBサイトは子（`qolc.jp/jcb`）としてパスで内包する。
1つのNext.jsプロジェクトでVercelに `qolc.jp`（公開）と `app.qolc.jp`（4ポータル）を向け、middlewareでホスト名分岐する。

| サイト | 状態 | 公開URL | 本番実装先 |
|---|---|---|---|
| QOLCプロモサイト | 原案 | `qolc.jp` | `src/app/(marketing)/` |
| JCB総合窓口LP | 原案 | **`qolc.jp/jcb`** | `src/app/(jcb)/jcb/`（サブドメインでなくパス。親にSEO集約・共通化のため） |
| QOLCアプリ（4ポータル） | 実装中 | `app.qolc.jp` | `src/app/{admin,facility,provider,user}/` |
| UDコーポレートサイト | 原案 | `uni-dev.jp` | 別リポジトリ／別デプロイ — QOLCプロジェクト外 |

公開サイトの本番はVercel。`wireframes-deploy/` のNetlifyは原案プレビュー専用として当面併用する。

実装時はワイヤーフレームの各セクションをReactコンポーネントへ分解し、`QOLC_design_system.html` のデザイントークン／shadcn/ui に準拠させる。詳細な移行方針は [`wireframes/README.md`](./wireframes/README.md) を参照。
