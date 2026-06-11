/**
 * ポータルダッシュボードの上部に表示するウェルカム＋できることセクション
 *
 * 初めて使う利用者でも、このポータルで何ができるかが一目で分かるよう、
 * キャッチコピーと機能カードを並べる。各カードは該当ページへのリンク。
 */
import Link from "next/link";
import { PORTAL_LABELS, PORTAL_TAGLINES } from "@/lib/portal/menu";
import type { PortalType } from "@/types";

export interface PortalFeature {
  /** 絵文字のアイコン（軽量にしたいので Lucide ではなく絵文字） */
  emoji: string;
  /** 機能名 */
  title: string;
  /** 補足説明（1〜2行） */
  description: string;
  /** クリック先のパス */
  href: string;
}

export interface PortalWelcomeProps {
  portal: PortalType;
  features: PortalFeature[];
}

export function PortalWelcome({ portal, features }: PortalWelcomeProps) {
  return (
    <div className="mb-6">
      <div
        className="rounded-xl p-6 mb-5 border"
        style={{
          backgroundColor: "var(--qolc-bg-soft)",
          borderColor: "var(--qolc-border)",
        }}
      >
        <h2
          className="text-xl sm:text-2xl font-bold mb-1"
          style={{ color: "var(--qolc-primary)" }}
        >
          {PORTAL_LABELS[portal]} へようこそ
        </h2>
        <p className="text-sm sm:text-base" style={{ color: "var(--qolc-text)" }}>
          {PORTAL_TAGLINES[portal]}
        </p>
      </div>

      <h3
        className="text-base font-semibold mb-3"
        style={{ color: "var(--qolc-text)" }}
      >
        ここでできること
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {features.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="rounded-lg border p-4 transition-shadow hover:shadow-md bg-white"
            style={{ borderColor: "var(--qolc-border)" }}
          >
            <div className="text-3xl mb-2" aria-hidden>
              {f.emoji}
            </div>
            <div
              className="font-semibold mb-1"
              style={{ color: "var(--qolc-text)" }}
            >
              {f.title}
            </div>
            <div className="text-sm" style={{ color: "var(--qolc-muted)" }}>
              {f.description}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** ポータル別の機能カード定義（ダッシュボードで使用） */
export const PORTAL_FEATURES: Record<PortalType, PortalFeature[]> = {
  admin: [
    {
      emoji: "🏥",
      title: "介護施設の管理",
      description: "登録施設の確認・追加・編集ができます。",
      href: "/admin/facilities",
    },
    {
      emoji: "🏪",
      title: "加盟店の管理",
      description: "決済を受ける加盟店の管理ができます。",
      href: "/admin/merchants",
    },
    {
      emoji: "💳",
      title: "決済管理",
      description: "全体の決済状況の確認・取消・返金ができます。",
      href: "/admin/payments",
    },
    {
      emoji: "🔄",
      title: "データ変換",
      description: "セゾン/JCBのCSVを取込用に変換できます。",
      href: "/admin/csv-tools",
    },
    {
      emoji: "📚",
      title: "マスタ管理",
      description: "アップロード形式などの基本設定を管理します。",
      href: "/admin/master",
    },
  ],
  facility: [
    {
      emoji: "👥",
      title: "入居者の管理",
      description: "入居者の登録・編集・ご家族の招待ができます。",
      href: "/facility/residents",
    },
    {
      emoji: "📋",
      title: "明細の管理",
      description: "サービス利用明細のアップロード・確認ができます。",
      href: "/facility/statements",
    },
    {
      emoji: "💳",
      title: "決済状況の確認",
      description: "月ごとの決済状況や履歴を確認できます。",
      href: "/facility/payments",
    },
    {
      emoji: "🩺",
      title: "サービス提供者の確認",
      description: "契約しているサービス事業者の一覧を見られます。",
      href: "/facility/providers",
    },
  ],
  provider: [
    {
      emoji: "📤",
      title: "明細のアップロード",
      description: "サービス利用明細のCSVをアップロードできます。",
      href: "/provider/upload",
    },
    {
      emoji: "🏥",
      title: "取引先施設の確認",
      description: "サービスを提供している施設の一覧を見られます。",
      href: "/provider/facilities",
    },
  ],
  user: [
    {
      emoji: "📋",
      title: "ご利用明細",
      description: "月ごとのご利用内容を確認できます。",
      href: "/user/statements",
    },
    {
      emoji: "🧾",
      title: "領収書",
      description: "領収書のダウンロード・印刷ができます。",
      href: "/user/receipts",
    },
    {
      emoji: "💳",
      title: "カードの管理",
      description: "お支払い用のクレジットカードを登録・変更できます。",
      href: "/user/card",
    },
  ],
};
