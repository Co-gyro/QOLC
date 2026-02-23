"use client";

import { useState } from "react";
import { CreditCard, Shield, Info } from "lucide-react";

// ダミー: ログインユーザー情報
const currentUser = {
  accountType: "self" as "self" | "family",
  name: "山田 太郎",
  isBillingPerson: true,
};

// 決済担当者の情報（自分が担当でない場合に表示）
const billingPerson = {
  name: "山田 太郎",
  accountType: "self" as "self" | "family",
};

export default function UserCardPage() {
  const [cardRegistered, setCardRegistered] = useState(false);
  const cardBrand = "Visa";
  const cardLast4 = "1234";
  const cardExpiry = "12/27";

  // 決済担当でない場合
  if (!currentUser.isBillingPerson) {
    return (
      <div className="px-4 py-5 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">カード管理</h2>
          <p className="text-sm text-gray-500 mt-0.5">お支払いに使用するカード情報</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
          <Info className="w-10 h-10 text-blue-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-2">
            あなたは決済担当ではありません
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            決済担当：{billingPerson.name} 様（{billingPerson.accountType === "self" ? "本人" : "家族"}）
          </p>
          <p className="text-xs text-gray-500">
            カードの登録・変更は決済担当の方が行います。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">カード管理</h2>
        <p className="text-sm text-gray-500 mt-0.5">お支払いに使用するカード情報</p>
      </div>

      {cardRegistered ? (
        <>
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-8">
              <CreditCard className="w-8 h-8 opacity-80" />
              <span className="text-sm font-medium opacity-80">{cardBrand}</span>
            </div>
            <p className="text-xl tracking-[0.2em] font-mono mb-4">•••• •••• •••• {cardLast4}</p>
            <div className="flex items-center justify-between text-sm opacity-80">
              <span>{currentUser.name}</span>
              <span>{cardExpiry}</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-500">登録カード情報</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm text-gray-500">カードブランド</span><span className="text-base text-gray-900">{cardBrand}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">カード番号</span><span className="text-base text-gray-900">•••• {cardLast4}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">有効期限</span><span className="text-base text-gray-900">{cardExpiry}</span></div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">カード情報はQOLCに保存されません</p>
              <p className="text-xs text-gray-500 mt-1">カード情報は決済代行会社（USEN PSP）が安全に管理しています。</p>
            </div>
          </div>

          <button onClick={() => alert("USEN PSPのカード変更画面に遷移します（準備中）")} className="w-full bg-emerald-600 text-white text-base font-medium rounded-xl py-3.5 active:bg-emerald-700">
            カード情報を変更する
          </button>
          <button onClick={() => alert("カードの削除には施設管理者へのお問い合わせが必要です")} className="w-full text-red-500 text-sm font-medium py-2">
            カードを削除する
          </button>
        </>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mb-5">
              <CreditCard className="w-10 h-10 text-orange-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">カードが登録されていません</h3>
            <p className="text-base text-gray-600 leading-relaxed mb-8">サービス利用料の自動決済には<br />カード登録が必要です</p>
            <button
              onClick={() => { alert("USEN PSPのカード登録画面に遷移します（準備中）"); setCardRegistered(true); }}
              className="w-full bg-emerald-600 text-white text-lg font-bold rounded-xl py-4 active:bg-emerald-700 shadow-md"
            >
              カードを登録する
            </button>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">安全なカード登録</p>
              <p className="text-xs text-gray-500 mt-1">カード情報は決済代行会社（USEN PSP）が安全に管理します。QOLCにカード番号は保存されません。</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">よくある質問</h3>
            <div><p className="text-sm font-medium text-gray-900">Q. どのカードが使えますか？</p><p className="text-xs text-gray-500 mt-1">Visa、Mastercard、JCBがご利用いただけます。</p></div>
            <div><p className="text-sm font-medium text-gray-900">Q. カード情報は安全ですか？</p><p className="text-xs text-gray-500 mt-1">カード情報は決済代行会社（USEN PSP）がPCI DSS準拠の環境で管理しています。</p></div>
            <div><p className="text-sm font-medium text-gray-900">Q. いつ決済されますか？</p><p className="text-xs text-gray-500 mt-1">サービス利用の都度、自動で決済されます。</p></div>
          </div>
        </>
      )}
    </div>
  );
}
