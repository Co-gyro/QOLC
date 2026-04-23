# QOLC (コルク) - 介護施設向け決済SaaS

## プロジェクト概要
介護施設の入居者が利用したサービスの明細をアップロードすると
即時にカード決済され、入居者・家族がLINE/Webで確認できるSaaSシステム。

## 技術スタック
- Next.js 14+ (App Router) / TypeScript
- Supabase (PostgreSQL + Auth)
- Vercel (ホスティング)
- shadcn/ui + Tailwind CSS

## 現在の開発フェーズ
Phase 0: セルフィッシュ用CSV生成システム

## 重要なルール
- 文字コード: セルフィッシュ用CSVはShift-JIS（CP932）で出力
- 改行コード: CRLF
- CSV命名規則: {カード会社}_{データ種別}_{締日}_{支払先番号}.csv
- JCB CSVは加工せずリネームのみ
- セゾンCSVはUR=リネーム、FI/FM=集計処理が必要
