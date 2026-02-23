"use client";

import { useState } from "react";
import { AlertTriangle, Bell, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

const recentStatements = [
  { id: "s1", date: "2025-02-10", provider: "田中内科クリニック", description: "初診料", amount: 850 },
  { id: "s2", date: "2025-02-08", provider: "さくら薬局", description: "調剤料", amount: 460 },
  { id: "s3", date: "2025-02-07", provider: "あおぞらタクシー", description: "通院送迎", amount: 3200 },
];

// ダミー: ログインユーザー情報
// accountType: "self" = 入居者本人, "family" = 家族
const currentUser = {
  accountType: "self" as "self" | "family",
  name: "山田 太郎",
  residentName: "山田 太郎",
  isBillingPerson: true,
};

export default function UserHomePage() {
  const [cardNotRegistered] = useState(true);
  const isSelf = currentUser.accountType === "self";

  return (
    <div className="px-4 py-5 space-y-5">
      {/* 挨拶 */}
      <div>
        <p className="text-lg font-bold text-gray-900">
          こんにちは、{currentUser.name} 様
        </p>
        {!isSelf && (
          <p className="text-base text-gray-600">
            {currentUser.residentName} 様のご家族
          </p>
        )}
      </div>

      {/* カード未登録警告バナー（決済担当の場合のみ） */}
      {cardNotRegistered && currentUser.isBillingPerson && (
        <Link
          href="/user/card"
          className="block bg-orange-50 border border-orange-200 rounded-xl p-4 active:bg-orange-100"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800">カードが未登録です</p>
              <p className="text-sm text-orange-700 mt-0.5">
                自動決済を利用するにはカード登録が必要です
              </p>
            </div>
            <span className="text-sm text-orange-600 font-medium flex-shrink-0 self-center">
              登録する
            </span>
          </div>
        </Link>
      )}

      {/* お知らせ */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <Bell className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">お知らせ</p>
          <p className="text-sm text-emerald-700 mt-1">2月分の明細が届いています。ご確認ください。</p>
        </div>
      </div>

      {/* 今月のご利用額 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <p className="text-sm text-gray-500">今月のご利用額（2月）</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(45670)}</p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">利用件数: 8件</p>
          <Link
            href="/user/statements"
            className="text-sm text-emerald-600 font-medium flex items-center gap-0.5"
          >
            明細を見る
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 最近のご利用 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">最近のご利用</h2>
          <Link
            href="/user/statements"
            className="text-sm text-emerald-600 font-medium"
          >
            すべて見る
          </Link>
        </div>
        <div className="space-y-3">
          {recentStatements.map((s) => (
            <Link
              key={s.id}
              href={`/user/statements/${s.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 shadow-sm active:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-gray-900 truncate">{s.provider}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{s.date} ・ {s.description}</p>
                </div>
                <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(s.amount)}</p>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* カード情報 */}
      {currentUser.isBillingPerson && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">お支払いカード</p>
              {cardNotRegistered ? (
                <p className="text-sm font-medium text-orange-500 mt-0.5">未登録</p>
              ) : (
                <p className="text-base font-medium text-gray-900 mt-0.5">Visa •••• 1234</p>
              )}
            </div>
            <Link
              href="/user/card"
              className="text-sm text-emerald-600 font-medium flex items-center gap-0.5"
            >
              {cardNotRegistered ? "登録する" : "変更"}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
